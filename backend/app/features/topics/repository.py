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

    if restore_words and topic_deleted_at is not None:
        for word in topic.words:
            # Restore any word deleted as part of the same topic-delete operation,
            # including shared words when delete_words=True was used.
            if (
                word.deleted_at is not None
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
