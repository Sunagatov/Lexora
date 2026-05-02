from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.shared.logging_utils import log_audit_event
from app.features.topics.api import get_active_subtree_topic_ids
from app.features.words.ai_curation import import_service as _import_service
from app.features.words.ai_curation.common import AiCurationImportError as _AiCurationImportError, _get_topic
from app.features.words.ai_curation.export_support import (
    EXPORT_INSTRUCTIONS as EXPORT_INSTRUCTIONS,
    export_topic_words_lean_page as _export_topic_words_lean_page,
    export_topic_words_page as _export_topic_words_page,
    list_topics_page as _list_topics_page,
)
from app.features.words.ai_curation.import_support import AiCurationImportOperations
from app.features.words.ai_curation.schemas import (
    AiCurationTopicListResponse,
    AiCurationTopicWordsLeanResponse,
    AiCurationTopicWordsResponse,
)

logger = logging.getLogger(__name__)

AiCurationImportError = _AiCurationImportError
InvalidTopicNameError = _import_service.InvalidTopicNameError
TopicSlugConflictError = _import_service.TopicSlugConflictError
DuplicateWordInTopicError = _import_service.DuplicateWordInTopicError
create_topic = _import_service.create_topic
create_word = _import_service.create_word
update_word = _import_service.update_word
_resolve_topic_ref = _import_service._resolve_topic_ref


def import_ai_curation(db: Session, payload):
    result = _import_service.import_ai_curation(
        db,
        payload,
        operations=AiCurationImportOperations(
            create_topic=create_topic,
            create_word=create_word,
            update_word=update_word,
            resolve_topic_ref=_resolve_topic_ref,
        ),
    )
    log_audit_event(
        "ai_curation_import_completed",
        source_topic_id=result.source_topic_id,
        dry_run=result.dry_run,
        result="dry_run" if result.dry_run else "applied",
        created_topics=len(result.created_topics),
        created_words=result.created_words,
        updated_words=result.updated_words,
        reassigned_words=result.reassigned_words,
        unchanged=result.unchanged,
    )
    return result


def list_topics_page(db: Session, page: int, page_size: int) -> AiCurationTopicListResponse:
    return _list_topics_page(db, page=page, page_size=page_size)


def export_topic_words_page(db: Session, topic_id: int, page: int, page_size: int) -> AiCurationTopicWordsResponse:
    topic = _get_topic(db, topic_id)
    subtree_topic_ids = get_active_subtree_topic_ids(db, topic.id)
    return _export_topic_words_page(
        db,
        topic,
        subtree_topic_ids,
        page=page,
        page_size=page_size,
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
    subtree_topic_ids = get_active_subtree_topic_ids(db, topic.id)
    return _export_topic_words_lean_page(
        db,
        topic,
        subtree_topic_ids,
        page=page,
        page_size=page_size,
        needs_examples_only=needs_examples_only,
    )
