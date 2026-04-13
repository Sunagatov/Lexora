from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate, TopicUpdate


class TopicRepository:
    @staticmethod
    def get_all(db: Session) -> list[Topic]:
        return list(db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name.asc())).all())

    @staticmethod
    def get_by_id(db: Session, topic_id: int) -> Topic | None:
        return db.scalar(select(Topic).where(Topic.id == topic_id).where(Topic.deleted_at.is_(None)))

    @staticmethod
    def get_by_id_including_deleted(db: Session, topic_id: int) -> Topic | None:
        return db.get(Topic, topic_id)

    @staticmethod
    def get_by_slug(db: Session, slug: str) -> Topic | None:
        return db.scalar(select(Topic).where(Topic.slug == slug).where(Topic.deleted_at.is_(None)))

    @staticmethod
    def get_deleted(db: Session) -> list[Topic]:
        return list(db.scalars(select(Topic).where(Topic.deleted_at.is_not(None)).order_by(Topic.deleted_at.desc())).all())

    @staticmethod
    def create(db: Session, payload: TopicCreate) -> Topic:
        topic = Topic(**payload.model_dump())
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def update(db: Session, topic: Topic, payload: TopicUpdate) -> Topic:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(topic, field, value)
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def soft_delete(db: Session, topic: Topic, delete_words: bool = False) -> Topic:
        now = datetime.now(timezone.utc)
        topic.deleted_at = now
        for word in topic.words:
            if word.deleted_at is None and len(word.topics) == 1:
                # Always soft-delete words that belong exclusively to this topic —
                # leaving them active would produce words with zero active topics.
                word.deleted_at = now
            elif delete_words and word.deleted_at is None:
                # delete_words=True also soft-deletes shared words (multi-topic).
                word.deleted_at = now
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def restore(db: Session, topic: Topic, restore_words: bool = False) -> Topic:
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

    @staticmethod
    def hard_delete(db: Session, topic: Topic) -> None:
        # Soft-delete active words that belong exclusively to this topic
        # to prevent orphaned words with zero topics after the cascade.
        now = datetime.now(timezone.utc)
        for word in topic.words:
            if word.deleted_at is None and len(word.topics) == 1:
                word.deleted_at = now
        db.delete(topic)
        db.commit()


topic_repo = TopicRepository()
