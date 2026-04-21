from __future__ import annotations

import logging
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic
from app.features.words.model import Word, word_topics
from app.features.words.repository import _with_details, create_word, update_word
from app.features.words.schemas import WordCreate, WordUpdate
from app.features.words.ai_curation.schemas import (
    AiCurationAllowedValues,
    AiCurationImportRequest,
    AiCurationImportResponse,
    AiCurationTopicListResponse,
    AiCurationTopicSummary,
    AiCurationTopicWordsResponse,
    AiCurationWord,
    CreatedTopicResult,
    CreateNewWordOperation,
    PaginationMeta,
    ReassignWordTopicsOperation,
    TopicRef,
    UpdateExistingWordOperation,
)
from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES

logger = logging.getLogger(__name__)


EXPORT_INSTRUCTIONS = [
    "Return valid JSON only.",
    "Keep schema_version unchanged.",
    "Existing words may be enriched but must keep the same id and term.",
    "You may create new topics using topic_operations with op=create_topic.",
    "You may create new words using word_operations with op=create_new_word.",
    "You may split large topics by adding/reassigning words into narrower topics.",
    "Do not create duplicates inside the same target topic.",
    "Use only allowed countability and part_of_speech values.",
]


class AiCurationImportError(Exception):
    pass


def _get_topic(db: Session, topic_id: int) -> Topic:
    topic = db.scalar(select(Topic).where(Topic.id == topic_id, Topic.deleted_at.is_(None)))
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
            id=row.id,
            name=row.name,
            slug=row.slug,
            description=row.description,
            is_active=row.is_active,
            word_count=row.word_count,
        )
        for row in rows
    ]
    return AiCurationTopicListResponse(
        items=items,
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
    )


def _word_to_export(word: Word) -> AiCurationWord:
    return AiCurationWord(
        id=word.id,
        topic_ids=[t.id for t in word.topics if t.deleted_at is None],
        term=word.term,
        translations=word.translations,
        translation_entries=[item.value for item in getattr(word, "translation_items", [])],
        pattern=word.pattern,
        example_entries=[item.value for item in getattr(word, "example_items", [])],
        countability=word.countability,
        part_of_speech=word.part_of_speech,
        past_simple=word.past_simple,
        past_participle=word.past_participle,
        notes=word.notes,
        knowledge_level=word.knowledge_level,
        is_active=word.is_active,
    )


def export_topic_words_page(db: Session, topic_id: int, page: int, page_size: int) -> AiCurationTopicWordsResponse:
    topic = _get_topic(db, topic_id)
    topic_filter = Word.topics.any((Topic.id == topic.id) & Topic.deleted_at.is_(None))

    total = db.scalar(
        select(func.count()).select_from(Word).where(Word.deleted_at.is_(None), topic_filter)
    ) or 0
    offset = (page - 1) * page_size

    words = list(
        db.scalars(
            _with_details(
                select(Word)
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
        source_topic=source_topic,
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
        allowed_values=AiCurationAllowedValues(
            countability=COUNTABILITY_VALUES,
            part_of_speech=PART_OF_SPEECH_VALUES,
        ),
        instructions=EXPORT_INSTRUCTIONS,
        words=[_word_to_export(word) for word in words],
    )


def _load_existing_words_for_source_topic(
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
    return {word.id: word for word in words}


def _assert_unique_existing_ids(ops: list[object]) -> None:
    ids = [op.id for op in ops if hasattr(op, "id")]
    duplicates = sorted(word_id for word_id, count in Counter(ids).items() if count > 1)
    if duplicates:
        raise AiCurationImportError(f"Duplicate existing word ids in payload: {duplicates}")


def _resolve_topic_ref(
    db: Session,
    ref: TopicRef,
    created_topics: dict[str, Topic],
) -> Topic:
    if ref.topic_id is not None:
        topic = db.scalar(select(Topic).where(Topic.id == ref.topic_id, Topic.deleted_at.is_(None)))
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


def _has_update_changes(word: Word, op: UpdateExistingWordOperation) -> bool:
    for field in op.model_fields_set - {"op", "id", "term"}:
        if getattr(op, field) != _current_value(word, field):
            return True
    return False


def import_ai_curation(db: Session, payload: AiCurationImportRequest) -> AiCurationImportResponse:
    source_topic = _get_topic(db, payload.source_topic_id)

    existing_ops = [
        op for op in payload.word_operations
        if isinstance(op, (UpdateExistingWordOperation, ReassignWordTopicsOperation))
    ]
    _assert_unique_existing_ids(existing_ops)

    existing_word_ids = [op.id for op in existing_ops]
    words_by_id = _load_existing_words_for_source_topic(db, source_topic.id, existing_word_ids)

    missing_ids = sorted(set(existing_word_ids) - set(words_by_id))
    if missing_ids:
        raise AiCurationImportError(
            f"These word ids do not exist in source topic '{source_topic.name}': {missing_ids}"
        )

    created_topics: dict[str, Topic] = {}
    created_topic_results: list[CreatedTopicResult] = []
    created_word_ids: list[int] = []
    updated_word_ids: list[int] = []
    reassigned_word_ids: list[int] = []
    unchanged = 0

    client_keys = [op.client_key for op in payload.topic_operations]
    duplicate_client_keys = sorted(key for key, count in Counter(client_keys).items() if count > 1)
    if duplicate_client_keys:
        raise AiCurationImportError(f"Duplicate topic client_keys: {duplicate_client_keys}")

    try:
        for op in payload.topic_operations:
            topic = create_topic(
                db,
                TopicCreate(name=op.name, description=op.description, is_active=op.is_active),
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

        for op in payload.word_operations:
            if isinstance(op, UpdateExistingWordOperation):
                word = words_by_id[op.id]
                if op.term != word.term:
                    raise AiCurationImportError(
                        f"Word {op.id} term mismatch: expected '{word.term}', got '{op.term}'"
                    )

                if not _has_update_changes(word, op):
                    unchanged += 1
                    continue

                data = op.model_dump(exclude_unset=True, exclude={"op", "id", "term"})
                data["progress_source"] = "json_import"
                update_word(db, word, WordUpdate(**data), commit=False)
                updated_word_ids.append(word.id)
                continue

            if isinstance(op, CreateNewWordOperation):
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
                continue

            if isinstance(op, ReassignWordTopicsOperation):
                word = words_by_id[op.id]
                if op.term != word.term:
                    raise AiCurationImportError(
                        f"Word {op.id} term mismatch: expected '{word.term}', got '{op.term}'"
                    )

                if payload.strict_mode:
                    created_topic_ids = {t.id for t in created_topics.values()}
                    bad_adds = [
                        ref for ref in op.add_topic_refs
                        if ref.topic_id is not None and ref.topic_id not in created_topic_ids
                    ]
                    if bad_adds:
                        raise AiCurationImportError(
                            f"strict_mode: reassign_word_topics for word {op.id} may only add "
                            f"topics created in this request"
                        )
                    bad_removes = [tid for tid in op.remove_topic_ids if tid != payload.source_topic_id]
                    if bad_removes:
                        raise AiCurationImportError(
                            f"strict_mode: reassign_word_topics for word {op.id} may only remove "
                            f"the source topic ({payload.source_topic_id}), got: {bad_removes}"
                        )

                current_topic_ids = {t.id for t in word.topics if t.deleted_at is None}
                add_topic_ids = {
                    _resolve_topic_ref(db, ref, created_topics).id
                    for ref in op.add_topic_refs
                }
                next_topic_ids = sorted((current_topic_ids | add_topic_ids) - set(op.remove_topic_ids))
                if not next_topic_ids:
                    raise AiCurationImportError(
                        f"Word {word.id} cannot end up without any topics"
                    )
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
                continue

            raise AiCurationImportError("Unsupported word operation")

        if payload.dry_run:
            db.rollback()
        else:
            db.commit()

        logger.info(
            "ai_curation.import: source_topic_id=%s dry_run=%s strict_mode=%s "
            "created_topics=%s created_words=%s updated_words=%s reassigned_words=%s unchanged=%s "
            "created_topic_ids=%s created_word_ids=%s updated_word_ids=%s reassigned_word_ids=%s",
            source_topic.id,
            payload.dry_run,
            payload.strict_mode,
            len(created_topic_results),
            len(created_word_ids),
            len(updated_word_ids),
            len(reassigned_word_ids),
            unchanged,
            [r.id for r in created_topic_results],
            created_word_ids,
            updated_word_ids,
            reassigned_word_ids,
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
    except Exception:
        db.rollback()
        raise
