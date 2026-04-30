from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.topics.repository import get_active_subtree_topic_ids
from app.features.stats.service import record_level_change
from app.features.words.model import Word, word_topics
from app.features.words.schemas import WordCreate, WordUpdate
from app.features.words.domain import existing_normalized_terms, assert_no_duplicate_word
from app.features.words.multivalue import sync_word_multivalue_fields
from app.features.words.repository_support import (
    apply_word_update_payload,
    record_word_level_change_if_needed,
)


def _with_details(stmt):
    return stmt.options(
        selectinload(Word.topics),
        selectinload(Word.translation_items),
        selectinload(Word.example_items),
    )


def get_all_words(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
    stmt = select(Word).where(Word.deleted_at.is_(None))
    if topic_id is not None:
        topic_ids = get_active_subtree_topic_ids(db, topic_id)
        stmt = (
            stmt.join(word_topics, word_topics.c.word_id == Word.id)
            .join(Topic, Topic.id == word_topics.c.topic_id)
            .where(Topic.id.in_(topic_ids))
            .where(Topic.deleted_at.is_(None))
            .distinct()
        )
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
    stmt = _with_details(stmt).order_by(Word.term.asc(), Word.id.asc())
    return list(db.scalars(stmt).all())


def get_word_by_id(db: Session, word_id: int) -> Word | None:
    return db.scalar(_with_details(select(Word).where(Word.id == word_id).where(Word.deleted_at.is_(None))))


def get_word_by_id_including_deleted(db: Session, word_id: int) -> Word | None:
    return db.scalar(_with_details(select(Word).where(Word.id == word_id)))


def get_deleted_words(db: Session) -> list[Word]:
    return list(db.scalars(
        _with_details(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc()))
    ).all())


def create_word(db: Session, payload: WordCreate, *, commit: bool = True) -> Word:
    assert_no_duplicate_word(payload.term, existing_normalized_terms(db, payload.topic_ids))
    topics: list[Topic] = list(db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all())
    data = payload.model_dump(
        exclude={"topic_ids", "translation_entries", "example_entries"}
    )
    word = Word(**data, topics=list(topics))
    sync_word_multivalue_fields(
        word,
        payload.translations,
        payload.translation_entries,
        payload.example,
        payload.example_entries,
    )
    db.add(word)
    if commit:
        db.commit()
        db.refresh(word)
    else:
        db.flush()
    return word


def update_word(db: Session, word: Word, payload: WordUpdate, *, commit: bool = True) -> Word:
    data = payload.model_dump(exclude_unset=True, exclude={"topic_ids", "progress_source"})
    effective_term = data.get("term", word.term)
    target_topic_ids = payload.topic_ids if payload.topic_ids is not None else [int(topic.id) for topic in word.topics]
    term_changed = "term" in data and effective_term != word.term
    topics_changed = payload.topic_ids is not None and set(payload.topic_ids) != {int(topic.id) for topic in word.topics}
    if term_changed or topics_changed:
        assert_no_duplicate_word(
            effective_term,
            existing_normalized_terms(db, target_topic_ids, exclude_word_id=word.id),
        )

    old_level = word.knowledge_level
    apply_word_update_payload(db, word, payload)
    if payload.topic_ids is not None:
        topics: list[Topic] = list(db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all())
        word.topics = topics

    record_word_level_change_if_needed(
        db,
        word,
        payload,
        old_level,
        record_level_change_fn=record_level_change,
    )
    db.add(word)
    if commit:
        db.commit()
        db.refresh(word)
    else:
        db.flush()
    return word


def soft_delete_word(db: Session, word: Word) -> Word:
    word.deleted_at = datetime.now(timezone.utc)
    word.deleted_via_topic_id = None
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def restore_word(db: Session, word: Word) -> Word:
    word.deleted_at = None
    word.deleted_via_topic_id = None
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def hard_delete_word(db: Session, word: Word) -> None:
    db.delete(word)
    db.commit()
