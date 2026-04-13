from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.shared.config import settings
from app.features.topics.model import Topic
from app.features.words.model import Word


def purge_trash(db: Session, force: bool = False) -> None:
    """Hard-delete trashed items in a single transaction.

    Before deleting trashed topics, soft-delete any active words that belong
    exclusively to those topics — same invariant as topic_repo.hard_delete().

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

    # Soft-delete active words that belong exclusively to a topic being purged
    for topic in topics_to_purge:
        for word in topic.words:
            if word.deleted_at is None and len(word.topics) == 1:
                word.deleted_at = now

    # Now delete the trashed topics (ON DELETE CASCADE removes word_topics rows)
    topic_ids = [t.id for t in topics_to_purge]
    if topic_ids:
        db.execute(Topic.__table__.delete().where(Topic.id.in_(topic_ids)))

    # Delete trashed words (those already soft-deleted, including ones we just marked)
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
