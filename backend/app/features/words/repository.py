from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.schemas import WordCreate, WordUpdate
from app.features.words.domain import existing_normalized_terms, assert_no_duplicate_word
from app.features.stats.service import record_level_change


def _with_topics(stmt):
    return stmt.options(selectinload(Word.topics))


def get_all_words(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
    stmt = _with_topics(select(Word).where(Word.deleted_at.is_(None)).order_by(Word.term.asc()))
    if topic_id is not None:
        stmt = stmt.where(Word.topics.any(
            (Topic.id == topic_id) & Topic.deleted_at.is_(None)
        ))
    if search:
        needle = f"%{search}%"
        stmt = stmt.where(
            Word.term.ilike(needle)
            | Word.translations.ilike(needle)
            | Word.pattern.ilike(needle)
            | Word.example.ilike(needle)
            | Word.notes.ilike(needle)
            | Word.past_simple.ilike(needle)
            | Word.past_participle.ilike(needle)
        )
    return list(db.scalars(stmt).all())


def get_word_by_id(db: Session, word_id: int) -> Word | None:
    return db.scalar(_with_topics(select(Word).where(Word.id == word_id).where(Word.deleted_at.is_(None))))


def get_word_by_id_including_deleted(db: Session, word_id: int) -> Word | None:
    return db.scalar(_with_topics(select(Word).where(Word.id == word_id)))


def get_deleted_words(db: Session) -> list[Word]:
    return list(db.scalars(
        _with_topics(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc()))
    ).all())


def create_word(db: Session, payload: WordCreate) -> Word:
    assert_no_duplicate_word(payload.term, existing_normalized_terms(db, payload.topic_ids))
    topics = db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all()
    data = payload.model_dump(exclude={"topic_ids"})
    word = Word(**data, topics=list(topics))
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def update_word(db: Session, word: Word, payload: WordUpdate) -> Word:
    data = payload.model_dump(exclude_unset=True, exclude={"topic_ids", "progress_source"})
    effective_term = data.get("term", word.term)
    target_topic_ids = payload.topic_ids if payload.topic_ids is not None else [t.id for t in word.topics]
    term_changed   = "term" in data and effective_term != word.term
    topics_changed = payload.topic_ids is not None and set(payload.topic_ids) != {t.id for t in word.topics}
    if term_changed or topics_changed:
        assert_no_duplicate_word(
            effective_term,
            existing_normalized_terms(db, target_topic_ids, exclude_word_id=word.id),
        )

    old_level = word.knowledge_level
    for field, value in data.items():
        setattr(word, field, value)
    if payload.topic_ids is not None:
        word.topics = list(db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all())
    if "knowledge_level" in data and data["knowledge_level"] != old_level:
        source = payload.progress_source or "manual"
        record_level_change(db, word.id, old_level, data["knowledge_level"], source)
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def soft_delete_word(db: Session, word: Word) -> Word:
    word.deleted_at = datetime.now(timezone.utc)
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def restore_word(db: Session, word: Word) -> Word:
    word.deleted_at = None
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def hard_delete_word(db: Session, word: Word) -> None:
    db.delete(word)
    db.commit()


# Backward-compatible shim so existing callers (words/router.py) keep working
class _WordRepo:
    get_all = staticmethod(get_all_words)
    get_by_id = staticmethod(get_word_by_id)
    get_by_id_including_deleted = staticmethod(get_word_by_id_including_deleted)
    get_deleted = staticmethod(get_deleted_words)
    create = staticmethod(create_word)
    update = staticmethod(update_word)
    soft_delete = staticmethod(soft_delete_word)
    restore = staticmethod(restore_word)
    hard_delete = staticmethod(hard_delete_word)


word_repo = _WordRepo()
