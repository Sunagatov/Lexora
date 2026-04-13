from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.features.topics.model import Topic
from app.features.words.model import Word


def purge_trash(db: Session, force: bool = False) -> None:
    """Hard-delete trashed items in a single transaction.

    With force=True deletes everything in trash.
    Otherwise deletes only items older than the configured retention period.
    """
    if force:
        db.execute(
            Word.__table__.delete().where(Word.deleted_at.isnot(None))
        )
        db.execute(
            Topic.__table__.delete().where(Topic.deleted_at.isnot(None))
        )
    else:
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.trash_retention_days)
        db.execute(
            Word.__table__.delete()
            .where(Word.deleted_at.isnot(None))
            .where(Word.deleted_at < cutoff)
        )
        db.execute(
            Topic.__table__.delete()
            .where(Topic.deleted_at.isnot(None))
            .where(Topic.deleted_at < cutoff)
        )
    db.commit()
