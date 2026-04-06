from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.word import Word
from app.schemas.word import WordCreate, WordUpdate


class WordCRUD:
    @staticmethod
    def get_all(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
        stmt = select(Word).order_by(Word.term.asc())

        if topic_id is not None:
            stmt = stmt.where(Word.topic_id == topic_id)

        if search:
            stmt = stmt.where(Word.term.ilike(f"%{search}%"))

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_by_id(db: Session, word_id: int) -> Word | None:
        return db.get(Word, word_id)

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
    def delete(db: Session, word: Word) -> None:
        db.delete(word)
        db.commit()


word_crud = WordCRUD()