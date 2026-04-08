from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicUpdate


class TopicCRUD:
    @staticmethod
    def get_all(db: Session) -> list[Topic]:
        stmt = select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name.asc())
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_by_id(db: Session, topic_id: int) -> Topic | None:
        return db.get(Topic, topic_id)

    @staticmethod
    def get_by_slug(db: Session, slug: str) -> Topic | None:
        stmt = select(Topic).where(Topic.slug == slug).where(Topic.deleted_at.is_(None))
        return db.scalar(stmt)

    @staticmethod
    def get_deleted(db: Session) -> list[Topic]:
        stmt = select(Topic).where(Topic.deleted_at.is_not(None)).order_by(Topic.deleted_at.desc())
        return list(db.scalars(stmt).all())

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
        if delete_words:
            for word in topic.words:
                if word.deleted_at is None:
                    word.deleted_at = now
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def restore(db: Session, topic: Topic, restore_words: bool = False) -> Topic:
        topic.deleted_at = None
        if restore_words:
            for word in topic.words:
                word.deleted_at = None
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def hard_delete(db: Session, topic: Topic) -> None:
        db.delete(topic)
        db.commit()


topic_crud = TopicCRUD()
