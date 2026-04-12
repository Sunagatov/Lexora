import re
import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.schemas import WordCreate, WordUpdate


def _normalize_term(term: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', term)).strip().lower()


def _load_topics(stmt):
    return stmt.options(selectinload(Word.topics))


class WordRepository:
    @staticmethod
    def get_all(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
        stmt = _load_topics(
            select(Word).where(Word.deleted_at.is_(None)).order_by(Word.term.asc())
        )
        if topic_id is not None:
            stmt = stmt.where(Word.topics.any(Topic.id == topic_id))
        if search:
            stmt = stmt.where(Word.term.ilike(f"%{search}%"))
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_by_id(db: Session, word_id: int) -> Word | None:
        return db.scalar(_load_topics(select(Word).where(Word.id == word_id).where(Word.deleted_at.is_(None))))

    @staticmethod
    def get_by_id_including_deleted(db: Session, word_id: int) -> Word | None:
        return db.scalar(_load_topics(select(Word).where(Word.id == word_id)))

    @staticmethod
    def get_deleted(db: Session) -> list[Word]:
        return list(
            db.scalars(
                _load_topics(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc()))
            ).all()
        )

    @staticmethod
    def create(db: Session, payload: WordCreate) -> Word:
        norm_term = _normalize_term(payload.term)
        # Reject if same term already exists (non-deleted) in any of the requested topics
        existing = db.scalars(
            select(Word)
            .where(Word.deleted_at.is_(None))
            .where(Word.topics.any(Topic.id.in_(payload.topic_ids)))
        ).all()
        for w in existing:
            if _normalize_term(w.term) == norm_term:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Word '{payload.term}' already exists in one of the selected topics",
                )

        topics = db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all()
        data = payload.model_dump(exclude={"topic_ids"})
        word = Word(**data, topics=list(topics))
        db.add(word)
        db.commit()
        db.refresh(word)
        return word

    @staticmethod
    def update(db: Session, word: Word, payload: WordUpdate) -> Word:
        data = payload.model_dump(exclude_unset=True, exclude={"topic_ids"})
        effective_term = data.get("term", word.term)
        target_topic_ids = payload.topic_ids if payload.topic_ids is not None else [t.id for t in word.topics]
        term_changed  = "term" in data and _normalize_term(data["term"]) != _normalize_term(word.term)
        topics_changed = payload.topic_ids is not None and set(payload.topic_ids) != {t.id for t in word.topics}
        if term_changed or topics_changed:
            norm = _normalize_term(effective_term)
            existing = db.scalars(
                select(Word)
                .where(Word.deleted_at.is_(None))
                .where(Word.id != word.id)
                .where(Word.topics.any(Topic.id.in_(target_topic_ids)))
            ).all()
            for w in existing:
                if _normalize_term(w.term) == norm:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Word '{effective_term}' already exists in one of the selected topics",
                    )
        for field, value in data.items():
            setattr(word, field, value)
        if payload.topic_ids is not None:
            word.topics = list(db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all())
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
