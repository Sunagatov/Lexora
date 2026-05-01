from __future__ import annotations

from typing import cast

from sqlalchemy.orm import Session

from app.features.topics.constants import TOPIC_SLUG_MAX_LEN
from app.features.topics.exceptions import (
    InvalidTopicNameError as InvalidTopicNameError,
    InvalidTopicParentError as InvalidTopicParentError,
    MissingTopicsError as MissingTopicsError,
    TopicHasActiveChildrenError as TopicHasActiveChildrenError,
    TopicNameConflictError as TopicNameConflictError,
    TopicSlugConflictError as TopicSlugConflictError,
)
from app.features.topics.model import Topic
from app.features.topics.rules import (
    assert_active_topic_name_available as assert_active_topic_name_available,
    assert_slug_available as assert_slug_available,
    assert_topic_has_no_active_children as assert_topic_has_no_active_children,
    build_topic_slug as build_topic_slug,
    assert_topic_parent_valid as assert_topic_parent_valid,
    assert_topics_exist as assert_topics_exist,
)
from app.features.topics.schemas import TopicCreate, TopicUpdate
from app.features.topics.sidebar_stats import compute_topic_sidebar_stats as compute_topic_sidebar_stats
from app.features.topics.repository import update_topic as persist_topic_update
from app.shared.text import slugify as slugify


def _build_topic_slug(name: str) -> str:
    slug = slugify(name, max_len=TOPIC_SLUG_MAX_LEN)
    if not slug:
        raise InvalidTopicNameError(name)
    return slug


def create_topic(db: Session, payload: TopicCreate, *, commit: bool = True) -> Topic:
    server_slug = _build_topic_slug(payload.name)
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


def create_topic_draft(
    db: Session,
    *,
    name: str,
    description: str | None = None,
    parent_topic_id: int | None = None,
    is_active: bool = True,
) -> Topic:
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
    db: Session,
    *,
    name: str,
    description: str | None = None,
    parent_topic_id: int | None = None,
    is_active: bool = True,
    commit: bool = True,
) -> Topic:
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


def update_topic(db: Session, topic: Topic, payload: TopicUpdate) -> Topic:
    if payload.name is not None and payload.name != topic.name:
        name_value = cast(str, payload.name)
        assert_active_topic_name_available(db, name_value, exclude_topic_id=topic.id)

    if payload.slug is not None:
        if payload.slug != topic.slug:
            slug_value = payload.slug
            assert slug_value is not None
            normalized_slug = _build_topic_slug(slug_value)
            payload.slug = normalized_slug
            assert_slug_available(db, normalized_slug, exclude_topic_id=topic.id)
    elif payload.name is not None:
        if payload.name != topic.name:
            name_value = payload.name
            assert name_value is not None
            derived_slug = _build_topic_slug(name_value)
            assert_slug_available(db, derived_slug, exclude_topic_id=topic.id)
            payload.slug = derived_slug

    if "parent_topic_id" in payload.model_fields_set:
        assert_topic_parent_valid(db, payload.parent_topic_id, exclude_topic_id=topic.id)

    return persist_topic_update(db, topic, payload)
