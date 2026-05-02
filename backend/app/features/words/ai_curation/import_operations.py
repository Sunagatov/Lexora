from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.features.words.ai_curation.common import AiCurationImportError
from app.features.words.ai_curation.import_support import (
    AiCurationImportOperations,
    _check_stale,
    _has_changes,
    _resolve_topic_id_set,
)
from app.features.words.ai_curation.schemas import (
    AiCurationImportRequest,
    CreatedTopicResult,
)
from app.features.words.constants import PROGRESS_SOURCE_JSON_IMPORT
from app.features.words.model import Word
from app.features.words.schemas import WordCreate, WordUpdate


def _process_topic_operations(
    db: Session,
    payload: AiCurationImportRequest,
    operations: AiCurationImportOperations,
) -> tuple[dict[str, object], list[CreatedTopicResult]]:
    client_keys = [operation.client_key for operation in payload.topic_operations]
    duplicate_client_keys = sorted(key for key, count in Counter(client_keys).items() if count > 1)
    if duplicate_client_keys:
        raise AiCurationImportError(f"Duplicate topic client_keys: {duplicate_client_keys}")

    created_topics: dict[str, object] = {}
    created_topic_results: list[CreatedTopicResult] = []
    for operation in payload.topic_operations:
        topic = operations.create_topic(
            db,
            operation,
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
    created_topics: dict[str, object],
    operations: AiCurationImportOperations,
) -> list[int]:
    created_word_ids: list[int] = []

    for op in payload.word_creates:
        target_topic_ids = sorted(_resolve_topic_id_set(operations, db, op.target_topic_refs, created_topics))
        if not target_topic_ids:
            raise AiCurationImportError(f"New word '{op.term}' has no target topics")

        create_kwargs: dict = dict(
            topic_ids=target_topic_ids,
            term=op.term,
            translation_entries=list(op.translation_entries),
            pattern=op.pattern,
            example_entries=op.example_entries,
            countability=op.countability,
            part_of_speech=op.part_of_speech,
            definition=op.definition,
            cefr_level=op.cefr_level,
            frequency_rank=op.frequency_rank,
            synonym_entries=op.synonym_entries,
            antonym_entries=op.antonym_entries,
            collocation_entries=op.collocation_entries,
            notes=op.notes,
            knowledge_level=op.knowledge_level,
            is_active=op.is_active,
        )
        # language defaults to None on WordCreateV2 but "en" on WordCreate;
        # only forward when explicitly set.
        if "language" in op.model_fields_set:
            create_kwargs["language"] = op.model_dump(include={"language"})["language"]
        # "register" shadows ABCMeta.register on BaseModel; use model_fields_set.
        if "register" in op.model_fields_set:
            create_kwargs["register"] = op.model_dump(include={"register"})["register"]

        word = operations.create_word(
            db,
            WordCreate(**create_kwargs),
            commit=False,
        )
        created_word_ids.append(word.id)

    return created_word_ids


def _process_word_reassigns(
    db: Session,
    payload: AiCurationImportRequest,
    words_by_id: dict[int, Word],
    created_topics: dict[str, object],
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
            _validate_strict_reassign(payload, op.id, op.add_topic_refs, op.remove_topic_ids, created_topics)

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


def _validate_strict_reassign(
    payload: AiCurationImportRequest,
    word_id: int,
    add_topic_refs,
    remove_topic_ids: list[int],
    created_topics: dict[str, object],
) -> None:
    created_topic_ids = {topic.id for topic in created_topics.values()}
    bad_adds = [
        ref for ref in add_topic_refs
        if ref.topic_id is not None and ref.topic_id not in created_topic_ids
    ]
    if bad_adds:
        raise AiCurationImportError(
            f"strict_mode: word_reassigns for word {word_id} may only add topics created in this request"
        )

    bad_removes = [topic_id for topic_id in remove_topic_ids if topic_id != payload.source_topic_id]
    if bad_removes:
        raise AiCurationImportError(
            f"strict_mode: word_reassigns for word {word_id} may only remove "
            f"the source topic ({payload.source_topic_id}), got: {bad_removes}"
        )
