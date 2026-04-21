from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import cast

from app.shared.text import slugify
from app.shared.constraints import TOPIC_SLUG_MAX_LEN
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate, TopicUpdate
from app.features.topics.repository import update_topic as persist_topic_update


class TopicSlugConflictError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class InvalidTopicNameError(Exception):
    """Raised when a topic name cannot produce a valid slug."""
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"Cannot generate a valid slug from name '{name}'")


class InvalidTopicParentError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class TopicNameConflictError(Exception):
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


def assert_active_topic_name_available(
    db: Session,
    name: str,
    exclude_topic_id: int | None = None,
) -> None:
    normalized = name.strip().casefold()
    existing = db.scalar(
        select(Topic)
        .where(func.lower(Topic.name) == normalized)
        .where(Topic.deleted_at.is_(None))
    )
    if existing is None or existing.id == exclude_topic_id:
        return
    raise TopicNameConflictError(f"Active topic name '{name}' already exists")


def assert_topics_exist(db: Session, topic_ids: list[int]) -> None:
    """Raise MissingTopicsError if any of the given topic ids do not exist as active topics."""
    found = set(db.scalars(
        select(Topic.id).where(Topic.id.in_(topic_ids)).where(Topic.deleted_at.is_(None))
    ).all())
    missing = [tid for tid in topic_ids if tid not in found]
    if missing:
        raise MissingTopicsError(missing)


def assert_topic_parent_valid(db: Session, parent_topic_id: int | None, *, exclude_topic_id: int | None = None) -> None:
    if parent_topic_id is None:
        return

    parent = db.scalar(select(Topic).where(Topic.id == parent_topic_id, Topic.deleted_at.is_(None)))
    if parent is None:
        raise InvalidTopicParentError(f"Parent topic {parent_topic_id} not found")
    if exclude_topic_id is not None and parent.id == exclude_topic_id:
        raise InvalidTopicParentError("A topic cannot be its own parent")

    seen: set[int] = set()
    current = parent
    while current.parent_topic_id is not None:
        if current.parent_topic_id in seen:
            break
        seen.add(current.id)
        if exclude_topic_id is not None and current.parent_topic_id == exclude_topic_id:
            raise InvalidTopicParentError("Topic parent cannot be one of its descendants")
        current = db.scalar(select(Topic).where(Topic.id == current.parent_topic_id, Topic.deleted_at.is_(None)))
        if current is None:
            break


def create_topic(db: Session, payload: TopicCreate, *, commit: bool = True) -> Topic:
    server_slug = slugify(payload.name, max_len=TOPIC_SLUG_MAX_LEN)
    if not server_slug:
        raise InvalidTopicNameError(payload.name)
    assert_active_topic_name_available(db, payload.name)
    assert_slug_available(db, server_slug)
    assert_topic_parent_valid(db, payload.parent_topic_id)
    topic = Topic(
        name=payload.name,
        slug=server_slug,
        description=payload.description,
        parent_topic_id=payload.parent_topic_id,
        is_active=payload.is_active,
    )
    db.add(topic)
    if commit:
        db.commit()
        db.refresh(topic)
    else:
        db.flush()
    return topic


def update_topic(db: Session, topic: Topic, payload: TopicUpdate) -> Topic:
    if payload.name is not None and payload.name != topic.name:
        name_value = cast(str, payload.name)
        assert_active_topic_name_available(db, name_value, exclude_topic_id=topic.id)

    if payload.slug is not None:
        if payload.slug != topic.slug:
            slug_value = payload.slug
            assert slug_value is not None
            normalized_slug = slugify(slug_value, max_len=TOPIC_SLUG_MAX_LEN)
            if not normalized_slug:
                raise InvalidTopicNameError(slug_value)
            payload.slug = normalized_slug
            assert_slug_available(db, normalized_slug, exclude_topic_id=topic.id)
    elif payload.name is not None:
        if payload.name != topic.name:
            name_value = payload.name
            assert name_value is not None
            derived_slug = slugify(name_value, max_len=TOPIC_SLUG_MAX_LEN)
            if not derived_slug:
                raise InvalidTopicNameError(name_value)
            assert derived_slug is not None
            assert_slug_available(db, derived_slug, exclude_topic_id=topic.id)
            payload.slug = derived_slug

    if "parent_topic_id" in payload.model_fields_set:
        assert_topic_parent_valid(db, payload.parent_topic_id, exclude_topic_id=topic.id)

    return persist_topic_update(db, topic, payload)
