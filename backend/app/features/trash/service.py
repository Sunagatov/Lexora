from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.shared.config import settings
from app.features.topics.model import Topic
from app.features.topics.domain import soft_delete_exclusive_words
from app.features.words.model import Word


def purge_trash(db: Session, force: bool = False) -> None:
    """Hard-delete trashed items in a single transaction.

    Before deleting trashed topics, soft-delete any active words that belong
    exclusively to those topics — enforced via the shared domain helper.

    With force=True deletes everything in trash.
    Otherwise deletes only items older than the configured retention period.
    """
    now = datetime.now(timezone.utc)

    if force:
        topics_to_purge = db.scalars(
            select(Topic)
            .where(Topic.deleted_at.isnot(None))
            .options(selectinload(Topic.words))
        ).all()
    else:
        cutoff = now - timedelta(days=settings.trash_retention_days)
        topics_to_purge = db.scalars(
            select(Topic)
            .where(Topic.deleted_at.isnot(None))
            .where(Topic.deleted_at < cutoff)
            .options(selectinload(Topic.words))
        ).all()

    for topic in topics_to_purge:
        soft_delete_exclusive_words(topic, now)

    topic_ids = [t.id for t in topics_to_purge]
    if topic_ids:
        db.execute(Topic.__table__.delete().where(Topic.id.in_(topic_ids)))

    if force:
        db.execute(Word.__table__.delete().where(Word.deleted_at.isnot(None)))
    else:
        cutoff = now - timedelta(days=settings.trash_retention_days)
        db.execute(
            Word.__table__.delete()
            .where(Word.deleted_at.isnot(None))
            .where(Word.deleted_at < cutoff)
        )

    db.commit()
