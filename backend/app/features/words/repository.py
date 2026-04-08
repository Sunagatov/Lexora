from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.words.model import Word
from app.features.words.schemas import WordCreate, WordUpdate


class WordRepository:
    @staticmethod
    def get_all(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
        stmt = select(Word).where(Word.deleted_at.is_(None)).order_by(Word.term.asc())
        if topic_id is not None:
            stmt = stmt.where(Word.topic_id == topic_id)
        if search:
            stmt = stmt.where(Word.term.ilike(f"%{search}%"))
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_by_id(db: Session, word_id: int) -> Word | None:
        return db.get(Word, word_id)

    @staticmethod
    def get_deleted(db: Session) -> list[Word]:
        return list(db.scalars(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc())).all())

    @staticmethod
    def create(db: Session, payload: WordCreate) -> Word:
        word = Word(**payload.model_dump())
        db.add(word)
        db.commit()
        db.refresh(word)
        return word

    @staticmethod
    def update(db: Session, word: Word, payload: WordUpdate) -> Word:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(word, field, value)
        db.add(word)
        db.commit()
        db.refresh(word)
        return word

    @staticmethod
    def soft_delete(db: Session, word: Word) -> Word:
        word.deleted_at = datetime.now(timezone.utc)
        db.add(word)
        db.commit()
        db.refresh(word)
        return word

    @staticmethod
    def restore(db: Session, word: Word) -> Word:
        word.deleted_at = None
        db.add(word)
        db.commit()
        db.refresh(word)
        return word

    @staticmethod
    def hard_delete(db: Session, word: Word) -> None:
        db.delete(word)
        db.commit()


word_repo = WordRepository()
