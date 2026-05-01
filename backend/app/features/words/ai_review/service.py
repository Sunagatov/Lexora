from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.topics.repository import get_active_subtree_topic_ids, get_active_topic_or_none
from app.features.words.ai_review.exceptions import AiReviewImportError
from app.features.words.ai_review.export_support import (
    EXPORT_INSTRUCTIONS as EXPORT_INSTRUCTIONS,
    build_topic_ai_review_export as _build_topic_ai_review_export,
)
from app.features.words.ai_review.import_support import (
    assert_import_words_present,
    assert_not_stale,
    assert_term_matches,
    assert_unique_word_ids as _assert_unique_word_ids,
    build_update_payload as _build_update_payload,
    has_changes as _has_changes,
    load_import_words as _load_import_words,
)
from app.features.words.ai_review.schemas import (
    AiReviewExportResponse,
    AiReviewImportRequest,
    AiReviewImportResponse,
)
from app.features.words.repository import update_word


def _get_topic(db: Session, topic_id: int):
    topic = get_active_topic_or_none(db, topic_id)
    if topic is None:
        raise AiReviewImportError(f"Topic {topic_id} not found")
    return topic


def build_topic_ai_review_export(
    db: Session,
    topic_id: int,
    page: int,
    page_size: int,
) -> AiReviewExportResponse:
    topic = _get_topic(db, topic_id)
    subtree_topic_ids = get_active_subtree_topic_ids(db, topic.id)
    return _build_topic_ai_review_export(
        db,
        topic,
        subtree_topic_ids,
        page=page,
        page_size=page_size,
    )

def import_topic_ai_review(db: Session, payload: AiReviewImportRequest) -> AiReviewImportResponse:
    topic = _get_topic(db, payload.topic_id)
    word_ids = [word.id for word in payload.words]
    _assert_unique_word_ids(word_ids, AiReviewImportError)

    subtree_topic_ids = get_active_subtree_topic_ids(db, topic.id)
    words_by_id = _load_import_words(db, topic.id, word_ids, subtree_topic_ids)
    assert_import_words_present(payload, words_by_id, topic.name, AiReviewImportError)

    updated_ids: list[int] = []
    unchanged = 0
    try:
        assert_term_matches(payload, words_by_id, AiReviewImportError)
        assert_not_stale(payload, words_by_id, AiReviewImportError)

        for item in payload.words:
            word = words_by_id[item.id]
            if not _has_changes(word, item):
                unchanged += 1
                continue
            update_payload = _build_update_payload(item)
            updated_ids.append(word.id)
            if not payload.dry_run:
                update_word(db, word, update_payload, commit=False)

        if payload.dry_run:
            db.rollback()
        else:
            db.commit()

    except Exception:
        db.rollback()
        raise

    return AiReviewImportResponse(
        topic_id=topic.id,
        topic_name=topic.name,
        dry_run=payload.dry_run,
        updated=len(updated_ids),
        unchanged=unchanged,
        updated_word_ids=updated_ids,
    )
