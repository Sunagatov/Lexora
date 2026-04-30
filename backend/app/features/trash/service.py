from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import bindparam, select
from sqlalchemy.orm import Session, selectinload

from app.shared.config import settings
from app.shared.logging_utils import log_audit_event
from app.features.topics.model import Topic
from app.features.words.model import Word

logger = logging.getLogger(__name__)


def _word_loses_all_remaining_topics(word: Word, purged_topic_ids: set[int]) -> bool:
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
    now = datetime.now(timezone.utc)

    topic_stmt = (
        select(Topic)
        .where(Topic.deleted_at.isnot(None))
        .options(selectinload(Topic.words).selectinload(Word.topics))
    )

    if not force:
        cutoff = now - timedelta(days=settings.trash_retention_days)
        topic_stmt = topic_stmt.where(Topic.deleted_at < cutoff)

    topics_to_purge = db.scalars(topic_stmt).all()
    purged_topic_ids = {t.id for t in topics_to_purge}

    words_to_hard_delete_ids: set[int] = set()
    for topic in topics_to_purge:
        for word in topic.words:
            if word.deleted_at is None and _word_loses_all_remaining_topics(word, purged_topic_ids):
                words_to_hard_delete_ids.add(word.id)

    topic_ids = [t.id for t in topics_to_purge]
    deleted_topics = 0
    if topic_ids:
        result = db.execute(Topic.__table__.delete().where(Topic.id.in_(topic_ids)))
        deleted_topics = result.rowcount or 0

    deleted_words = 0
    if force:
        word_result = db.execute(Word.__table__.delete().where(Word.deleted_at.isnot(None)))
        deleted_words += word_result.rowcount or 0
    else:
        cutoff = now - timedelta(days=settings.trash_retention_days)
        word_result = db.execute(
            Word.__table__.delete().where(
                (Word.deleted_at.isnot(None)) & (Word.deleted_at < cutoff)
            )
        )
        deleted_words = word_result.rowcount or 0

    if words_to_hard_delete_ids:
        orphan_word_result = db.execute(
            Word.__table__.delete().where(
                Word.id.in_(bindparam("orphan_word_ids", expanding=True))
            ),
            {"orphan_word_ids": sorted(words_to_hard_delete_ids)},
        )
        deleted_words += orphan_word_result.rowcount or 0

    db.commit()

    log_audit_event(
        "trash.purged",
        force=force,
        deleted_topics=deleted_topics,
        deleted_words=deleted_words,
    )
