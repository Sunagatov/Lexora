from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

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


def count_active_topics(db) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Topic)
            .where(Topic.deleted_at.is_(None))
        )
        or 0
    )


def list_active_topics_page_rows(db, *, offset: int, page_size: int, word_cls, word_topics_table):
    stmt = (
        select(
            Topic.id,
            Topic.name,
            Topic.slug,
            Topic.description,
            Topic.is_active,
            func.count(word_cls.id).label("word_count"),
        )
        .select_from(Topic)
        .outerjoin(word_topics_table, word_topics_table.c.topic_id == Topic.id)
        .outerjoin(word_cls, (word_cls.id == word_topics_table.c.word_id) & word_cls.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .group_by(Topic.id)
        .order_by(Topic.name.asc(), Topic.id.asc())
        .offset(offset)
        .limit(page_size)
    )
    return db.execute(stmt).all()


def list_deleted_topics_for_purge(db, *, deleted_before: datetime | None = None):
    from app.features.words.model import Word

    stmt = (
        select(Topic)
        .where(Topic.deleted_at.isnot(None))
        .options(selectinload(Topic.words).selectinload(Word.topics))
    )
    if deleted_before is not None:
        stmt = stmt.where(Topic.deleted_at < deleted_before)
    return list(db.scalars(stmt).all())


def hard_delete_topics_by_ids(db, topic_ids: list[int]) -> int:
    if not topic_ids:
        return 0
    result = db.execute(Topic.__table__.delete().where(Topic.id.in_(topic_ids)))
    return result.rowcount or 0


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


def create_topic_from_values(
    db,
    *,
    name: str,
    description: str | None = None,
    parent_topic_id: int | None = None,
    is_active: bool = True,
    commit: bool = True,
):
    return create_topic(
        db,
        TopicCreate(
            name=name,
            description=description,
            parent_topic_id=parent_topic_id,
            is_active=is_active,
        ),
        commit=commit,
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
    "create_topic_from_values",
    "count_active_topics",
    "create_topic",
    "find_active_topic_by_exact_name",
    "find_active_topic_by_slug",
    "find_deleted_topic_by_exact_name",
    "find_deleted_topic_by_slug",
    "get_deleted_topics",
    "get_active_topic_or_none",
    "get_active_subtree_topic_ids",
    "get_topic_by_id_including_deleted",
    "hard_delete_topics_by_ids",
    "list_active_topics_page_rows",
    "list_deleted_topics_for_purge",
    "restore_topic",
]
