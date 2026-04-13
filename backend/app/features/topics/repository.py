from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.schemas import TopicUpdate
from app.features.topics.domain import soft_delete_exclusive_words, soft_delete_all_words


def get_all_topics(db: Session) -> list[Topic]:
    return list(db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name.asc())).all())


def get_topic_by_id(db: Session, topic_id: int) -> Topic | None:
    return db.scalar(select(Topic).where(Topic.id == topic_id).where(Topic.deleted_at.is_(None)))


def get_topic_by_id_including_deleted(db: Session, topic_id: int) -> Topic | None:
    return db.get(Topic, topic_id)


def get_topic_by_slug(db: Session, slug: str) -> Topic | None:
    return db.scalar(select(Topic).where(Topic.slug == slug).where(Topic.deleted_at.is_(None)))


def get_deleted_topics(db: Session) -> list[Topic]:
    return list(db.scalars(select(Topic).where(Topic.deleted_at.is_not(None)).order_by(Topic.deleted_at.desc())).all())


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
    topic_deleted_at = topic.deleted_at
    topic.deleted_at = None
    if restore_words:
        for word in topic.words:
            # Only restore words deleted at the same time as the topic
            # (i.e. deleted as part of this topic deletion, not independently).
            if (
                len(word.topics) == 1
                and word.deleted_at is not None
                and topic_deleted_at is not None
                and abs((word.deleted_at - topic_deleted_at).total_seconds()) < 5
            ):
                word.deleted_at = None
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def hard_delete_topic(db: Session, topic: Topic) -> None:
    soft_delete_exclusive_words(topic)
    db.delete(topic)
    db.commit()


# Backward-compatible aliases so existing callers keep working during migration
class _TopicRepo:
    get_all = staticmethod(get_all_topics)
    get_by_id = staticmethod(get_topic_by_id)
    get_by_id_including_deleted = staticmethod(get_topic_by_id_including_deleted)
    get_by_slug = staticmethod(get_topic_by_slug)
    get_deleted = staticmethod(get_deleted_topics)
    update = staticmethod(update_topic)
    soft_delete = staticmethod(soft_delete_topic)
    restore = staticmethod(restore_topic)
    hard_delete = staticmethod(hard_delete_topic)


topic_repo = _TopicRepo()
