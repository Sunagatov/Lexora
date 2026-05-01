from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.topics.schemas import TopicUpdate
from app.features.topics.domain import soft_delete_exclusive_words, soft_delete_all_words
from app.features.words.progress import WordProgressEvent  # noqa: F401
from app.features.words.domain import assert_word_restore_allowed
from app.features.words.model import Word


def get_all_topics(db: Session) -> list[Topic]:
    return list(db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name.asc())).all())


def get_all_topics_with_words(db: Session) -> list[Topic]:
    stmt = (
        select(Topic)
        .where(Topic.deleted_at.is_(None))
        .options(selectinload(Topic.words).selectinload(Word.topics))
        .order_by(Topic.name.asc())
    )
    return list(db.scalars(stmt).all())


def get_topic_by_id(db: Session, topic_id: int) -> Topic | None:
    return db.scalar(select(Topic).where(Topic.id == topic_id).where(Topic.deleted_at.is_(None)))


def get_active_topic_or_none(db: Session, topic_id: int) -> Topic | None:
    return get_topic_by_id(db, topic_id)


def get_topic_by_id_with_words(db: Session, topic_id: int) -> Topic | None:
    stmt = (
        select(Topic)
        .where(Topic.id == topic_id)
        .where(Topic.deleted_at.is_(None))
        .options(selectinload(Topic.words).selectinload(Word.topics))
    )
    return db.scalar(stmt)


def get_topic_by_id_including_deleted(db: Session, topic_id: int) -> Topic | None:
    return db.scalars(select(Topic).where(Topic.id == topic_id)).first()


def get_topic_by_slug(db: Session, slug: str) -> Topic | None:
    return db.scalar(select(Topic).where(Topic.slug == slug).where(Topic.deleted_at.is_(None)))


def find_active_topic_by_exact_name(db: Session, topic_name: str) -> Topic | None:
    normalized = topic_name.strip().casefold()
    return db.scalar(
        select(Topic)
        .where(func.lower(Topic.name) == normalized)
        .where(Topic.deleted_at.is_(None))
    )


def find_deleted_topic_by_exact_name(db: Session, topic_name: str) -> Topic | None:
    normalized = topic_name.strip().casefold()
    return db.scalar(
        select(Topic)
        .where(func.lower(Topic.name) == normalized)
        .where(Topic.deleted_at.isnot(None))
    )


def find_active_topic_by_slug(db: Session, slug: str) -> Topic | None:
    return get_topic_by_slug(db, slug)


def find_deleted_topic_by_slug(db: Session, slug: str) -> Topic | None:
    return db.scalar(
        select(Topic)
        .where(Topic.slug == slug)
        .where(Topic.deleted_at.isnot(None))
    )


def get_deleted_topics(db: Session) -> list[Topic]:
    return list(db.scalars(select(Topic).where(Topic.deleted_at.is_not(None)).order_by(Topic.deleted_at.desc())).all())


def get_active_subtree_topic_ids(db: Session, root_topic_id: int) -> list[int]:
    subtree = select(Topic.id).where(
        Topic.id == root_topic_id,
        Topic.deleted_at.is_(None),
    ).cte(name="topic_subtree", recursive=True)
    topic_children = (
        select(Topic.id)
        .join(subtree, Topic.parent_topic_id == subtree.c.id)
        .where(Topic.deleted_at.is_(None))
    )
    subtree = subtree.union_all(topic_children)
    stmt = select(subtree.c.id)
    rows = list(db.scalars(stmt).all())
    return [_coerce_topic_id(row) for row in rows]


def _coerce_topic_id(value) -> int:
    if hasattr(value, "id"):
        return int(value.id)
    return int(value)


def count_active_topics(db: Session) -> int:
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


def update_topic(db: Session, topic: Topic, payload: TopicUpdate) -> Topic:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def soft_delete_topic(db: Session, topic: Topic, delete_words: bool = False) -> Topic:
    now = datetime.now(timezone.utc)
    topic.deleted_at = now
    if delete_words:
        soft_delete_all_words(topic, now)
    else:
        soft_delete_exclusive_words(topic, now)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def restore_topic(db: Session, topic: Topic, restore_words: bool = False) -> Topic:
    if topic.parent_topic_id is not None:
        from app.features.topics.service import InvalidTopicParentError

        parent = db.scalar(
            select(Topic)
            .where(Topic.id == topic.parent_topic_id)
            .where(Topic.deleted_at.is_(None))
        )
        if parent is None:
            raise InvalidTopicParentError(
                "Cannot restore subtopic while its parent topic is deleted. Restore the parent first."
            )

    topic.deleted_at = None

    if restore_words:
        for word in topic.words:
            if word.deleted_at is not None and word.deleted_via_topic_id == topic.id:
                assert_word_restore_allowed(db, word, restoring_topic_ids={topic.id})

        for word in topic.words:
            if word.deleted_at is not None and word.deleted_via_topic_id == topic.id:
                word.deleted_at = None
                word.deleted_via_topic_id = None

    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def hard_delete_topic(db: Session, topic: Topic) -> None:
    soft_delete_exclusive_words(topic)
    db.delete(topic)
    db.commit()
