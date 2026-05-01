from __future__ import annotations

from sqlalchemy import func, select

from app.features.topics.exceptions import (
    InvalidTopicNameError,
    InvalidTopicParentError,
    MissingTopicsError,
    TopicNameConflictError,
    TopicSlugConflictError,
)
from app.features.topics.model import Topic
from app.features.topics.repository import (
    get_deleted_topics,
    get_active_subtree_topic_ids,
    get_topic_by_id_including_deleted,
    restore_topic,
)
from app.features.topics.rules import assert_topics_exist
from app.features.topics.schemas import TopicCreate
from app.features.topics.schemas import TopicResponse
from app.features.topics.service import create_topic


def find_active_topic_by_exact_name(db, topic_name: str):
    normalized = topic_name.strip().casefold()
    return db.scalar(
        select(Topic)
        .where(func.lower(Topic.name) == normalized)
        .where(Topic.deleted_at.is_(None))
    )


def find_deleted_topic_by_exact_name(db, topic_name: str):
    normalized = topic_name.strip().casefold()
    return db.scalar(
        select(Topic)
        .where(func.lower(Topic.name) == normalized)
        .where(Topic.deleted_at.isnot(None))
    )


def find_active_topic_by_slug(db, slug: str):
    return db.scalar(
        select(Topic)
        .where(Topic.slug == slug)
        .where(Topic.deleted_at.is_(None))
    )


def find_deleted_topic_by_slug(db, slug: str):
    return db.scalar(
        select(Topic)
        .where(Topic.slug == slug)
        .where(Topic.deleted_at.isnot(None))
    )


def get_active_topic_or_none(db, topic_id: int):
    return db.scalar(
        select(Topic)
        .where(Topic.id == topic_id)
        .where(Topic.deleted_at.is_(None))
    )


def create_topic_draft(
    db,
    *,
    name: str,
    description: str | None = None,
    parent_topic_id: int | None = None,
    is_active: bool = True,
):
    return create_topic(
        db,
        TopicCreate(
            name=name,
            description=description,
            parent_topic_id=parent_topic_id,
            is_active=is_active,
        ),
        commit=False,
    )

__all__ = [
    "InvalidTopicNameError",
    "InvalidTopicParentError",
    "MissingTopicsError",
    "TopicResponse",
    "TopicNameConflictError",
    "TopicSlugConflictError",
    "assert_topics_exist",
    "create_topic_draft",
    "create_topic",
    "find_active_topic_by_exact_name",
    "find_active_topic_by_slug",
    "find_deleted_topic_by_exact_name",
    "find_deleted_topic_by_slug",
    "get_deleted_topics",
    "get_active_topic_or_none",
    "get_active_subtree_topic_ids",
    "get_topic_by_id_including_deleted",
    "restore_topic",
]
