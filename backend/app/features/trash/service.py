from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.features.topics.repository import hard_delete_topics_by_ids, list_deleted_topics_for_purge
from app.features.words.repository import hard_delete_deleted_words, hard_delete_words_by_ids
from app.shared.logging_utils import log_audit_event
from app.shared.config import settings

logger = logging.getLogger(__name__)


def _word_loses_all_remaining_topics(word, purged_topic_ids: set[int]) -> bool:
    return not any(
        topic.deleted_at is None and topic.id not in purged_topic_ids
        for topic in word.topics
    )


def purge_trash(db: Session, force: bool = False) -> None:
    """Hard-delete trashed items in a single transaction.

    Active words that would become topicless after the purge are also hard-deleted.

    With force=True deletes everything in trash.
    Otherwise deletes only items older than the configured retention period.
    """
    started_at = time.perf_counter()
    now = datetime.now(timezone.utc)
    cutoff = None if force else now - timedelta(days=settings.trash_retention_days)
    topics_to_purge = list_deleted_topics_for_purge(db, deleted_before=cutoff)
    purged_topic_ids = {t.id for t in topics_to_purge}

    words_to_hard_delete_ids: set[int] = set()
    for topic in topics_to_purge:
        for word in topic.words:
            if word.deleted_at is None and _word_loses_all_remaining_topics(word, purged_topic_ids):
                words_to_hard_delete_ids.add(word.id)

    topic_ids = [t.id for t in topics_to_purge]
    deleted_topics = hard_delete_topics_by_ids(db, topic_ids)
    deleted_words = hard_delete_deleted_words(db, deleted_before=cutoff)
    deleted_words += hard_delete_words_by_ids(db, sorted(words_to_hard_delete_ids))

    db.commit()

    log_audit_event(
        "trash_purged",
        force=force,
        deleted_topic_count=deleted_topics,
        deleted_word_count=deleted_words,
        retention_days=None if force else settings.trash_retention_days,
        duration_ms=round((time.perf_counter() - started_at) * 1000, 2),
    )
