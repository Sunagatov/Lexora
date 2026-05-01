from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.topics.exceptions import InvalidTopicNameError, TopicSlugConflictError
from app.features.topics.service import create_topic_from_values as _create_topic_from_values
from app.features.words.ai_curation.common import AiCurationImportError, _get_topic
from app.features.words.ai_curation.import_loading import (
    load_existing_words as _load_existing_words,
    resolve_topic_ref as _resolve_topic_ref,
)
from app.features.words.ai_curation.import_operations import (
    _process_topic_operations,
    _process_word_creates,
    _process_word_reassigns,
    _process_word_updates,
)
from app.features.words.ai_curation.import_results import (
    AiCurationImportExecution,
    build_import_response,
    finalize_import_transaction,
)
from app.features.words.ai_curation.import_support import (
    AiCurationImportOperations,
    _assert_unique_ids,
    _validate_payload_ids,
)
from app.features.words.ai_curation.schemas import (
    AiCurationImportRequest,
    AiCurationImportResponse,
)
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.repository import create_word, update_word


def create_topic(db: Session, payload, commit: bool = True):
    return _create_topic_from_values(
        db,
        name=payload.name,
        description=payload.description,
        parent_topic_id=payload.parent_topic_id,
        is_active=payload.is_active,
        commit=commit,
    )


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
