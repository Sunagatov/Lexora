from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic


class AiCurationImportError(Exception):
    pass


def _get_topic(db: Session, topic_id: int) -> Topic:
    topic: Topic | None = db.scalar(select(Topic).where(Topic.id == topic_id, Topic.deleted_at.is_(None)))
    if topic is None:
        raise AiCurationImportError(f"Topic {topic_id} not found")
    return topic
