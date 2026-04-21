from __future__ import annotations

from datetime import datetime, timezone

from app.features.topics.model import Topic


def soft_delete_exclusive_words(topic: Topic, now: datetime | None = None) -> None:
    """Soft-delete active words that belong exclusively to this topic.

    Called before any topic removal (soft-delete, hard-delete, purge) to prevent
    active words from ending up with zero active topics.
    """
    ts = now or datetime.now(timezone.utc)
    for word in topic.words:
        if word.deleted_at is None and len(word.topics) == 1:
            word.deleted_at = ts
            word.deleted_via_topic_id = topic.id


def soft_delete_all_words(topic: Topic, now: datetime | None = None) -> None:
    """Soft-delete ALL active words associated with this topic (exclusive + shared).

    Used when delete_words=True is explicitly requested.
    """
    ts = now or datetime.now(timezone.utc)
    for word in topic.words:
        if word.deleted_at is None:
            word.deleted_at = ts
            word.deleted_via_topic_id = topic.id
