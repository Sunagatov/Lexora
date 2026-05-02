from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.topics.api import get_active_topic_or_none


class AiCurationImportError(Exception):
    pass


def _get_topic(db: Session, topic_id: int):
    topic = get_active_topic_or_none(db, topic_id)
    if topic is None:
        raise AiCurationImportError(f"Topic {topic_id} not found")
    return topic
