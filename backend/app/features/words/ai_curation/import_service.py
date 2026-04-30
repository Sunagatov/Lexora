from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic, InvalidTopicNameError, TopicSlugConflictError
from app.features.words.ai_curation.common import AiCurationImportError, _get_topic
from app.features.words.ai_curation.import_loading import (
    load_existing_words as _load_existing_words,
    resolve_topic_ref as _resolve_topic_ref,
)
from app.features.words.ai_curation.import_results import (
    AiCurationImportExecution,
    build_import_response,
    finalize_import_transaction,
)
from app.features.words.ai_curation.import_support import (
    AiCurationImportOperations,
    _assert_unique_ids,
    _check_stale,
    _has_changes,
    _resolve_topic_id_set,
    _validate_payload_ids,
)
from app.features.words.constants import PROGRESS_SOURCE_JSON_IMPORT
from app.features.words.ai_curation.schemas import (
    AiCurationImportRequest,
    AiCurationImportResponse,
    CreatedTopicResult,
)
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.model import Word
from app.features.words.repository import create_word, update_word
from app.features.words.schemas import WordCreate, WordUpdate


def _process_topic_operations(
    db: Session,
    payload: AiCurationImportRequest,
    operations: AiCurationImportOperations,
) -> tuple[dict[str, Topic], list[CreatedTopicResult]]:
    client_keys = [operation.client_key for operation in payload.topic_operations]
    duplicate_client_keys = sorted(key for key, count in Counter(client_keys).items() if count > 1)
    if duplicate_client_keys:
        raise AiCurationImportError(f"Duplicate topic client_keys: {duplicate_client_keys}")

    created_topics: dict[str, Topic] = {}
    created_topic_results: list[CreatedTopicResult] = []

    for operation in payload.topic_operations:
        topic = operations.create_topic(
            db,
            TopicCreate(
                name=operation.name,
                description=operation.description,
                parent_topic_id=operation.parent_topic_id,
                is_active=operation.is_active,
            ),
            commit=False,
        )
        created_topics[operation.client_key] = topic
        created_topic_results.append(
            CreatedTopicResult(
                client_key=operation.client_key,
                id=topic.id,
                name=topic.name,
                slug=topic.slug,
            )
        )

    return created_topics, created_topic_results


def _process_word_updates(
    db: Session,
    payload: AiCurationImportRequest,
    words_by_id: dict[int, Word],
    operations: AiCurationImportOperations,
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
        data["progress_source"] = PROGRESS_SOURCE_JSON_IMPORT
        operations.update_word(db, word, WordUpdate(**data), commit=False)
        updated_word_ids.append(word.id)

    return updated_word_ids, unchanged


def _process_word_creates(
    db: Session,
    payload: AiCurationImportRequest,
    created_topics: dict[str, Topic],
    operations: AiCurationImportOperations,
) -> list[int]:
    created_word_ids: list[int] = []

    for op in payload.word_creates:
        target_topic_ids = sorted(
            _resolve_topic_id_set(operations, db, op.target_topic_refs, created_topics)
        )
        if not target_topic_ids:
            raise AiCurationImportError(f"New word '{op.term}' has no target topics")

        word = operations.create_word(
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
    db: Session,
    payload: AiCurationImportRequest,
    words_by_id: dict[int, Word],
    created_topics: dict[str, Topic],
    operations: AiCurationImportOperations,
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
        add_topic_ids = _resolve_topic_id_set(operations, db, op.add_topic_refs, created_topics)
        next_topic_ids = sorted((current_topic_ids | add_topic_ids) - set(op.remove_topic_ids))
        if not next_topic_ids:
            raise AiCurationImportError(f"Word {word.id} cannot end up without any topics")
        if set(next_topic_ids) == current_topic_ids:
            unchanged += 1
            continue

        operations.update_word(
            db,
            word,
            WordUpdate(topic_ids=next_topic_ids, progress_source=PROGRESS_SOURCE_JSON_IMPORT),
            commit=False,
        )
        reassigned_word_ids.append(word.id)

    return reassigned_word_ids, unchanged


def import_ai_curation(
    db: Session,
    payload: AiCurationImportRequest,
    operations: AiCurationImportOperations | None = None,
) -> AiCurationImportResponse:
    operations = operations or AiCurationImportOperations(
        create_topic=create_topic,
        create_word=create_word,
        update_word=update_word,
        resolve_topic_ref=_resolve_topic_ref,
    )
    source_topic = _get_topic(db, payload.source_topic_id)

    update_ids = [op.id for op in payload.word_updates]
    reassign_ids = [op.id for op in payload.word_reassigns]
    _assert_unique_ids(update_ids, "word_updates")
    _assert_unique_ids(reassign_ids, "word_reassigns")

    existing_ids = update_ids + reassign_ids
    words_by_id = _load_existing_words(db, source_topic.id, existing_ids)
    _validate_payload_ids(payload, words_by_id)

    try:
        created_topics, created_topic_results = _process_topic_operations(db, payload, operations)
        updated_word_ids, updates_unchanged = _process_word_updates(db, payload, words_by_id, operations)
        created_word_ids = _process_word_creates(db, payload, created_topics, operations)
        reassigned_word_ids, reassigns_unchanged = _process_word_reassigns(
            db,
            payload,
            words_by_id,
            created_topics,
            operations,
        )

        unchanged = updates_unchanged + reassigns_unchanged
        finalize_import_transaction(db, payload, created_topic_results, created_word_ids)

        return build_import_response(
            source_topic,
            payload,
            AiCurationImportExecution(
                created_topic_results=created_topic_results,
                created_word_ids=created_word_ids,
                updated_word_ids=updated_word_ids,
                reassigned_word_ids=reassigned_word_ids,
                unchanged=unchanged,
            ),
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
