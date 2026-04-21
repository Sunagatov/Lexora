from __future__ import annotations

from collections import Counter
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.repository import get_active_subtree_topic_ids
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic, InvalidTopicNameError, TopicSlugConflictError
from app.features.words.ai_curation.common import AiCurationImportError, _get_topic
from app.features.words.ai_curation.schemas import (
    AiCurationImportRequest,
    AiCurationImportResponse,
    CreatedTopicResult,
    TopicRef,
    WordUpdateV2,
)
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.model import Word, word_topics
from app.features.words.repository import _with_details, create_word, update_word
from app.features.words.schemas import WordCreate, WordUpdate


def _load_existing_words(
    db: Session,
    source_topic_id: int,
    word_ids: list[int],
) -> dict[int, Word]:
    if not word_ids:
        return {}
    subtree_topic_ids = get_active_subtree_topic_ids(db, source_topic_id)
    words = db.scalars(
        _with_details(
            select(Word)
            .join(word_topics, word_topics.c.word_id == Word.id)
            .join(Topic, Topic.id == word_topics.c.topic_id)
            .where(Word.id.in_(word_ids))
            .where(Word.deleted_at.is_(None))
            .where(Topic.deleted_at.is_(None))
            .where(Topic.id.in_(subtree_topic_ids))
            .distinct()
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
