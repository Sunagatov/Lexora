from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.topics.exceptions import (
    InvalidTopicNameError,
    InvalidTopicParentError,
    MissingTopicsError,
    TopicHasActiveChildrenError,
    TopicNameConflictError,
    TopicSlugConflictError,
)
from app.features.topics.constants import TOPIC_SLUG_MAX_LEN
from app.features.topics.model import Topic
from app.shared.text import slugify


def build_topic_slug(name: str) -> str:
    slug = slugify(name, max_len=TOPIC_SLUG_MAX_LEN)
    if not slug:
        raise InvalidTopicNameError(name)
    return slug


def assert_topic_has_no_active_children(db: Session, topic_id: int) -> None:
    child_names = list(
        db.scalars(
            select(Topic.name)
            .where(Topic.parent_topic_id == topic_id)
            .where(Topic.deleted_at.is_(None))
            .order_by(Topic.name.asc())
        ).all()
    )
    if child_names:
        raise TopicHasActiveChildrenError(child_names)


def assert_slug_available(db: Session, slug: str, exclude_topic_id: int | None = None) -> None:
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
    found = set(
        db.scalars(select(Topic.id).where(Topic.id.in_(topic_ids)).where(Topic.deleted_at.is_(None))).all()
    )
    missing = [topic_id for topic_id in topic_ids if topic_id not in found]
    if missing:
        raise MissingTopicsError(missing)


def assert_topic_parent_valid(
    db: Session,
    parent_topic_id: int | None,
    *,
    exclude_topic_id: int | None = None,
) -> None:
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
