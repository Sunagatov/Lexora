from __future__ import annotations

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import cast

from app.shared.text import slugify
from app.shared.constraints import TOPIC_SLUG_MAX_LEN
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate, TopicSidebarStatsResponse, TopicUpdate
from app.features.topics.repository import update_topic as persist_topic_update
from app.features.words.model import Word, word_topics


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


class TopicHasActiveChildrenError(Exception):
    def __init__(self, child_names: list[str]) -> None:
        self.child_names = child_names
        self.detail = (
            "Cannot delete topic while active subtopics exist: "
            + ", ".join(child_names)
        )
        super().__init__(self.detail)


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


def compute_topic_sidebar_stats(db: Session) -> TopicSidebarStatsResponse:
    topics = list(db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.id.asc())).all())
    total_words = int(db.scalar(select(func.count()).select_from(Word).where(Word.deleted_at.is_(None))) or 0)
    if not topics:
        return TopicSidebarStatsResponse(total_words=total_words, topic_counts={}, topic_progress={})

    topics_by_id = {topic.id: topic for topic in topics}
    ancestors_by_topic_id: dict[int, list[int]] = {}

    def collect_ancestors(topic_id: int) -> list[int]:
        cached = ancestors_by_topic_id.get(topic_id)
        if cached is not None:
            return cached

        ancestors = [topic_id]
        parent_id = topics_by_id[topic_id].parent_topic_id
        while parent_id is not None and parent_id in topics_by_id:
            ancestors.append(parent_id)
            parent_id = topics_by_id[parent_id].parent_topic_id

        ancestors_by_topic_id[topic_id] = ancestors
        return ancestors

    for topic in topics:
        collect_ancestors(topic.id)

    counts: dict[int, int] = defaultdict(int)
    level_delta_sum: dict[int, int] = defaultdict(int)
    level_count: dict[int, int] = defaultdict(int)

    rows = db.execute(
        select(Word.id, Word.knowledge_level, word_topics.c.topic_id)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .order_by(Word.id.asc(), word_topics.c.topic_id.asc())
    )

    current_word_id: int | None = None
    current_level: int | None = None
    current_topic_ids: set[int] = set()

    def flush_word() -> None:
        if current_word_id is None:
            return

        ancestor_ids: set[int] = set()
        for topic_id in current_topic_ids:
            ancestor_ids.update(ancestors_by_topic_id.get(topic_id, [topic_id]))

        for ancestor_id in ancestor_ids:
            counts[ancestor_id] += 1
            if current_level is not None and 1 <= current_level <= 4:
                level_delta_sum[ancestor_id] += current_level - 1
                level_count[ancestor_id] += 1

    for word_id, level, topic_id in rows:
        word_id_int = int(word_id)
        if current_word_id is None:
            current_word_id = word_id_int
        elif word_id_int != current_word_id:
            flush_word()
            current_word_id = word_id_int
            current_topic_ids = set()

        current_level = int(level) if level is not None else None
        current_topic_ids.add(int(topic_id))

    flush_word()

    topic_counts = {topic.id: counts.get(topic.id, 0) for topic in topics}
    topic_progress: dict[int, int] = {}
    for topic in topics:
        active_count = level_count.get(topic.id, 0)
        if active_count <= 0:
            continue
        topic_progress[topic.id] = round(level_delta_sum[topic.id] * 100 / (3 * active_count))

    return TopicSidebarStatsResponse(
        total_words=total_words,
        topic_counts=topic_counts,
        topic_progress=topic_progress,
    )


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
