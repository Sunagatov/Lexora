from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.text import slugify
from app.shared.constraints import TOPIC_SLUG_MAX_LEN
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate, TopicUpdate
from app.features.topics.repository import topic_repo


class TopicSlugConflictError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class MissingTopicsError(Exception):
    def __init__(self, ids: list[int]) -> None:
        self.ids = ids
        super().__init__(f"Topics not found: {ids}")


def assert_slug_available(db: Session, slug: str, exclude_topic_id: int | None = None) -> None:
    """Raise TopicSlugConflictError if the slug is taken by any topic including soft-deleted."""
    existing = db.scalar(select(Topic).where(Topic.slug == slug))
    if existing is None or existing.id == exclude_topic_id:
        return
    detail = (
        f"Topic slug '{slug}' already exists"
        if existing.deleted_at is None
        else f"Topic slug '{slug}' is used by a deleted topic — restore or permanently delete it first"
    )
    raise TopicSlugConflictError(detail)


def assert_topics_exist(db: Session, topic_ids: list[int]) -> None:
    """Raise MissingTopicsError if any of the given topic ids do not exist as active topics."""
    found = set(db.scalars(
        select(Topic.id).where(Topic.id.in_(topic_ids)).where(Topic.deleted_at.is_(None))
    ).all())
    missing = [tid for tid in topic_ids if tid not in found]
    if missing:
        raise MissingTopicsError(missing)


def create_topic(db: Session, payload: TopicCreate) -> Topic:
    server_slug = slugify(payload.name, max_len=TOPIC_SLUG_MAX_LEN)
    if not server_slug:
        raise TopicSlugConflictError(f"Cannot generate a valid slug from name '{payload.name}'")
    assert_slug_available(db, server_slug)
    # Attach the generated slug before persisting
    topic = Topic(name=payload.name, slug=server_slug, description=payload.description, is_active=payload.is_active)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def update_topic(db: Session, topic: Topic, payload: TopicUpdate) -> Topic:
    if payload.slug and payload.slug != topic.slug:
        normalized_slug = slugify(payload.slug, max_len=TOPIC_SLUG_MAX_LEN) or payload.slug
        payload.slug = normalized_slug
        assert_slug_available(db, payload.slug, exclude_topic_id=topic.id)
    return topic_repo.update(db, topic, payload)
