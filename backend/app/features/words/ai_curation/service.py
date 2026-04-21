from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic, InvalidTopicNameError, TopicSlugConflictError
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count, example_enrichment_status, needs_example_enrichment
from app.features.words.model import Word, WordExample, word_topics
from app.features.words.repository import _with_details, create_word, update_word
from app.features.words.schemas import WordCreate, WordUpdate
from app.features.words.ai_curation.schemas import (
    AiCurationAllowedValues,
    AiCurationImportRequest,
    AiCurationImportResponse,
    AiCurationTopicListResponse,
    AiCurationTopicSummary,
    AiCurationTopicWordsLeanResponse,
    AiCurationTopicWordsResponse,
    AiCurationWord,
    AiCurationWordLean,
    CreatedTopicResult,
    PaginationMeta,
    TopicRef,
    WordUpdateV2,
)
from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES

logger = logging.getLogger(__name__)


EXPORT_INSTRUCTIONS = [
    "Return valid JSON only. No markdown fences. No explanation.",
    "schema_version must be 'lexora.ai-curation.v2'.",
    "To enrich existing words: use word_updates — include only id and the fields to change.",
    "To add new words: use word_creates — include term, translations, and all applicable fields.",
    "To move words between topics: use word_reassigns.",
    "Skip words that already have 3 strong example sentences.",
    "Use only allowed countability and part_of_speech values from allowed_values.",
    "Do not create duplicates inside the same target topic.",
]


class AiCurationImportError(Exception):
    pass


def _get_topic(db: Session, topic_id: int) -> Topic:
    topic: Topic | None = db.scalar(select(Topic).where(Topic.id == topic_id, Topic.deleted_at.is_(None)))
    if topic is None:
        raise AiCurationImportError(f"Topic {topic_id} not found")
    return topic


def list_topics_page(db: Session, page: int, page_size: int) -> AiCurationTopicListResponse:
    total = db.scalar(select(func.count()).select_from(Topic).where(Topic.deleted_at.is_(None))) or 0
    offset = (page - 1) * page_size

    rows = db.execute(
        select(
            Topic.id,
            Topic.name,
            Topic.slug,
            Topic.description,
            Topic.is_active,
            func.count(Word.id).label("word_count"),
        )
        .select_from(Topic)
        .outerjoin(word_topics, word_topics.c.topic_id == Topic.id)
        .outerjoin(Word, (Word.id == word_topics.c.word_id) & Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .group_by(Topic.id)
        .order_by(Topic.name.asc(), Topic.id.asc())
        .offset(offset)
        .limit(page_size)
    ).all()

    items = [
        AiCurationTopicSummary(
            id=int(row.id),
            name=str(row.name),
            slug=str(row.slug),
            description=row.description,
            is_active=bool(row.is_active),
            word_count=int(row.word_count),
        )
        for row in rows
    ]
    return AiCurationTopicListResponse(
        items=items,
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
    )


def _word_to_export(word: Word) -> AiCurationWord:
    example_count_value = example_count(word)
    return AiCurationWord(
        id=word.id,
        topic_ids=[int(topic.id) for topic in word.topics if topic.deleted_at is None],
        term=str(word.term),
        translations=str(word.translations),
        translation_entries=[item.value for item in getattr(word, "translation_items", [])],
        pattern=word.pattern,
        example_entries=[item.value for item in getattr(word, "example_items", [])],
        example_count=example_count_value,
        example_target_count=EXAMPLE_TARGET_COUNT,
        example_status=example_enrichment_status(example_count_value),
        needs_example_enrichment=needs_example_enrichment(word),
        countability=word.countability,
        part_of_speech=word.part_of_speech,
        past_simple=word.past_simple,
        past_participle=word.past_participle,
        notes=word.notes,
        knowledge_level=word.knowledge_level,
        is_active=word.is_active,
    )


def _needs_examples_filter():
    complete_word_ids = (
        select(WordExample.word_id)
        .group_by(WordExample.word_id)
        .having(func.count(WordExample.id) >= EXAMPLE_TARGET_COUNT)
    )
    return Word.id.not_in(complete_word_ids)


def export_topic_words_page(db: Session, topic_id: int, page: int, page_size: int) -> AiCurationTopicWordsResponse:
    topic = _get_topic(db, topic_id)
    topic_filter = (Topic.id == topic.id) & Topic.deleted_at.is_(None)

    total = db.scalar(
        select(func.count())
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None), topic_filter)
    ) or 0
    offset = (page - 1) * page_size

    words: list[Word] = list(
        db.scalars(
            _with_details(
                select(Word)
                .join(word_topics, word_topics.c.word_id == Word.id)
                .join(Topic, Topic.id == word_topics.c.topic_id)
                .where(Word.deleted_at.is_(None), topic_filter)
                .order_by(Word.term.asc(), Word.id.asc())
                .offset(offset)
                .limit(page_size)
            )
        ).all()
    )

    source_topic = AiCurationTopicSummary(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        description=topic.description,
        is_active=topic.is_active,
        word_count=total,
    )

    return AiCurationTopicWordsResponse(
        exported_at=datetime.now(timezone.utc),
        source_topic=source_topic,
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
        allowed_values=AiCurationAllowedValues(
            countability=COUNTABILITY_VALUES,
            part_of_speech=PART_OF_SPEECH_VALUES,
        ),
        instructions=EXPORT_INSTRUCTIONS,
        words=[_word_to_export(word) for word in words],
    )


def export_topic_words_lean_page(
    db: Session,
    topic_id: int,
    page: int,
    page_size: int,
    *,
    needs_examples_only: bool = False,
) -> AiCurationTopicWordsLeanResponse:
    topic = _get_topic(db, topic_id)
    topic_filter = (Topic.id == topic.id) & Topic.deleted_at.is_(None)
    needs_examples_filter = _needs_examples_filter() if needs_examples_only else None

    count_stmt = (
        select(func.count())
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None), topic_filter)
    )
    if needs_examples_filter is not None:
        count_stmt = count_stmt.where(needs_examples_filter)
    total = db.scalar(count_stmt) or 0
    offset = (page - 1) * page_size

    words_stmt = (
        select(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None), topic_filter)
    )
    if needs_examples_filter is not None:
        words_stmt = words_stmt.where(needs_examples_filter)

    words = list(
        db.scalars(
            _with_details(
                words_stmt
                .order_by(Word.term.asc(), Word.id.asc())
                .offset(offset)
                .limit(page_size)
            )
        ).all()
    )

    lean_words = []
    for word in words:
        count = example_count(word)
        lean_words.append(
            AiCurationWordLean(
                id=word.id,
                term=word.term,
                example_entries=[item.value for item in getattr(word, "example_items", [])] or None,
                example_count=count,
                example_target_count=EXAMPLE_TARGET_COUNT,
                example_status=example_enrichment_status(count),
                needs_example_enrichment=needs_example_enrichment(word),
            )
        )

    return AiCurationTopicWordsLeanResponse(
        source_topic_id=topic.id,
        exported_at=datetime.now(timezone.utc),
        total_words=total,
        words=lean_words,
    )


def _load_existing_words(
    db: Session,
    source_topic_id: int,
    word_ids: list[int],
) -> dict[int, Word]:
    if not word_ids:
        return {}
    words = db.scalars(
        _with_details(
            select(Word)
            .where(Word.id.in_(word_ids), Word.deleted_at.is_(None))
            .where(Word.topics.any((Topic.id == source_topic_id) & Topic.deleted_at.is_(None)))
        )
    ).all()
    return {int(word.id): word for word in words}


def _assert_unique_ids(ids: list[int], label: str) -> None:
    duplicates = sorted(word_id for word_id, count in Counter(ids).items() if count > 1)
    if duplicates:
        if label == "word_updates":
            raise AiCurationImportError(f"Duplicate existing word ids in payload: {duplicates}")
        if label == "word_reassigns":
            raise AiCurationImportError(f"Duplicate reassign word ids in payload: {duplicates}")
        raise AiCurationImportError(f"Duplicate {label} word ids in payload: {duplicates}")


def _resolve_topic_ref(
    db: Session,
    ref: TopicRef,
    created_topics: dict[str, Topic],
) -> Topic:
    if ref.topic_id is not None:
        topic: Topic | None = db.scalar(select(Topic).where(Topic.id == ref.topic_id, Topic.deleted_at.is_(None)))
        if topic is None:
            raise AiCurationImportError(f"Referenced topic {ref.topic_id} not found")
        return topic

    topic = created_topics.get(ref.client_key or "")
    if topic is None:
        raise AiCurationImportError(f"Referenced client_key '{ref.client_key}' was not created in topic_operations")
    return topic


def _current_value(word: Word, field: str):
    if field == "translation_entries":
        return [item.value for item in getattr(word, "translation_items", [])]
    if field == "example_entries":
        return [item.value for item in getattr(word, "example_items", [])]
    return getattr(word, field)


def _has_changes(word: Word, op: WordUpdateV2) -> bool:
    for field in op.model_fields_set - {"id"}:
        if getattr(op, field) != _current_value(word, field):
            return True
    return False


def _check_stale(word: Word, exported_at: datetime, label: str) -> None:
    if word.updated_at is not None and word.updated_at > exported_at:
        raise AiCurationImportError(
            f"{label}: word {word.id} ('{word.term}') was modified after export "
            f"(word.updated_at={word.updated_at.isoformat()}, "
            f"exported_at={exported_at.isoformat()}). Re-export and re-run."
        )


def _validate_payload_ids(payload: AiCurationImportRequest, words_by_id: dict[int, Word]) -> None:
    update_ids = [op.id for op in payload.word_updates]
    reassign_ids = [op.id for op in payload.word_reassigns]
    _assert_unique_ids(update_ids, "word_updates")
    _assert_unique_ids(reassign_ids, "word_reassigns")

    existing_ids = update_ids + reassign_ids
    missing_ids = sorted(set(existing_ids) - set(words_by_id))
    if missing_ids:
        raise AiCurationImportError(
            f"These word ids do not exist in source topic: {missing_ids}"
        )


def _process_topic_operations(
    db: Session, payload: AiCurationImportRequest
) -> tuple[dict[str, Topic], list[CreatedTopicResult]]:
    client_keys = [op.client_key for op in payload.topic_operations]
    duplicate_client_keys = sorted(key for key, count in Counter(client_keys).items() if count > 1)
    if duplicate_client_keys:
        raise AiCurationImportError(f"Duplicate topic client_keys: {duplicate_client_keys}")

    created_topics: dict[str, Topic] = {}
    created_topic_results: list[CreatedTopicResult] = []

    for op in payload.topic_operations:
        topic = create_topic(
            db,
            TopicCreate(
                name=op.name,
                description=op.description,
                parent_topic_id=op.parent_topic_id,
                is_active=op.is_active,
            ),
            commit=False,
        )
        created_topics[op.client_key] = topic
        created_topic_results.append(
            CreatedTopicResult(
                client_key=op.client_key,
                id=topic.id,
                name=topic.name,
                slug=topic.slug,
            )
        )

    return created_topics, created_topic_results


def _process_word_updates(
    db: Session, payload: AiCurationImportRequest, words_by_id: dict[int, Word]
) -> tuple[list[int], int]:
    updated_word_ids: list[int] = []
    unchanged = 0

    if payload.exported_at is not None:
        for op in payload.word_updates:
            _check_stale(words_by_id[op.id], payload.exported_at, "update_existing_word")

    for op in payload.word_updates:
        word = words_by_id[op.id]
        if op.term is not None and op.term != word.term:
            raise AiCurationImportError(
                f"word_updates for word {op.id}: term mismatch (payload='{op.term}', db='{word.term}')"
            )
        if not _has_changes(word, op):
            unchanged += 1
            continue
        data = op.model_dump(exclude_unset=True, exclude={"id"})
        data["progress_source"] = "json_import"
        update_word(db, word, WordUpdate(**data), commit=False)
        updated_word_ids.append(word.id)

    return updated_word_ids, unchanged


def _process_word_creates(
    db: Session, payload: AiCurationImportRequest, created_topics: dict[str, Topic]
) -> list[int]:
    created_word_ids: list[int] = []

    for op in payload.word_creates:
        target_topic_ids = [
            _resolve_topic_ref(db, ref, created_topics).id
            for ref in op.target_topic_refs
        ]
        if not target_topic_ids:
            raise AiCurationImportError(f"New word '{op.term}' has no target topics")

        word = create_word(
            db,
            WordCreate(
                topic_ids=target_topic_ids,
                term=op.term,
                translations=op.translations,
                translation_entries=op.translation_entries,
                pattern=op.pattern,
                example_entries=op.example_entries,
                countability=op.countability,
                part_of_speech=op.part_of_speech,
                past_simple=op.past_simple,
                past_participle=op.past_participle,
                notes=op.notes,
                knowledge_level=op.knowledge_level,
                is_active=op.is_active,
            ),
            commit=False,
        )
        created_word_ids.append(word.id)

    return created_word_ids


def _process_word_reassigns(
    db: Session, payload: AiCurationImportRequest, words_by_id: dict[int, Word], created_topics: dict[str, Topic]
) -> tuple[list[int], int]:
    reassigned_word_ids: list[int] = []
    unchanged = 0

    if payload.exported_at is not None:
        for op in payload.word_reassigns:
            _check_stale(words_by_id[op.id], payload.exported_at, "reassign_word_topics")

    for op in payload.word_reassigns:
        word = words_by_id[op.id]
        if op.term is not None and op.term != word.term:
            raise AiCurationImportError(
                f"word_reassigns for word {op.id}: term mismatch (payload='{op.term}', db='{word.term}')"
            )

        if payload.strict_mode:
            created_topic_ids = {topic.id for topic in created_topics.values()}
            bad_adds = [
                ref for ref in op.add_topic_refs
                if ref.topic_id is not None and ref.topic_id not in created_topic_ids
            ]
            if bad_adds:
                raise AiCurationImportError(
                    f"strict_mode: word_reassigns for word {op.id} may only add topics created in this request"
                )
            bad_removes = [tid for tid in op.remove_topic_ids if tid != payload.source_topic_id]
            if bad_removes:
                raise AiCurationImportError(
                    f"strict_mode: word_reassigns for word {op.id} may only remove "
                    f"the source topic ({payload.source_topic_id}), got: {bad_removes}"
                )

        current_topic_ids = {topic.id for topic in word.topics if topic.deleted_at is None}
        add_topic_ids = {
            _resolve_topic_ref(db, ref, created_topics).id
            for ref in op.add_topic_refs
        }
        next_topic_ids = sorted((current_topic_ids | add_topic_ids) - set(op.remove_topic_ids))
        if not next_topic_ids:
            raise AiCurationImportError(f"Word {word.id} cannot end up without any topics")
        if set(next_topic_ids) == current_topic_ids:
            unchanged += 1
            continue

        update_word(
            db,
            word,
            WordUpdate(topic_ids=next_topic_ids, progress_source="json_import"),
            commit=False,
        )
        reassigned_word_ids.append(word.id)

    return reassigned_word_ids, unchanged


def import_ai_curation(db: Session, payload: AiCurationImportRequest) -> AiCurationImportResponse:
    source_topic = _get_topic(db, payload.source_topic_id)

    update_ids = [op.id for op in payload.word_updates]
    reassign_ids = [op.id for op in payload.word_reassigns]
    _assert_unique_ids(update_ids, "word_updates")
    _assert_unique_ids(reassign_ids, "word_reassigns")

    existing_ids = update_ids + reassign_ids
    words_by_id = _load_existing_words(db, source_topic.id, existing_ids)
    _validate_payload_ids(payload, words_by_id)

    try:
        created_topics, created_topic_results = _process_topic_operations(db, payload)
        updated_word_ids, updates_unchanged = _process_word_updates(db, payload, words_by_id)
        created_word_ids = _process_word_creates(db, payload, created_topics)
        reassigned_word_ids, reassigns_unchanged = _process_word_reassigns(db, payload, words_by_id, created_topics)

        unchanged = updates_unchanged + reassigns_unchanged

        if payload.dry_run:
            db.rollback()
        else:
            db.commit()

        logger.info(
            "ai_curation.import: topic_id=%s dry_run=%s created_topics=%s created_words=%s "
            "updated_words=%s reassigned_words=%s unchanged=%s",
            source_topic.id,
            payload.dry_run,
            len(created_topic_results),
            len(created_word_ids),
            len(updated_word_ids),
            len(reassigned_word_ids),
            unchanged,
        )

        return AiCurationImportResponse(
            source_topic_id=source_topic.id,
            source_topic_name=source_topic.name,
            dry_run=payload.dry_run,
            created_topics=created_topic_results,
            created_words=len(created_word_ids),
            updated_words=len(updated_word_ids),
            reassigned_words=len(reassigned_word_ids),
            unchanged=unchanged,
            created_word_ids=created_word_ids,
            updated_word_ids=updated_word_ids,
            reassigned_word_ids=reassigned_word_ids,
        )
    except InvalidTopicNameError as e:
        db.rollback()
        raise AiCurationImportError(f"Cannot generate a valid slug from topic name '{e.name}'") from e
    except TopicSlugConflictError as e:
        db.rollback()
        raise AiCurationImportError(e.detail) from e
    except DuplicateWordInTopicError as e:
        db.rollback()
        raise AiCurationImportError(str(e)) from e
    except Exception:
        db.rollback()
        raise
