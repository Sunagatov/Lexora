from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.multivalue import sync_word_multivalue_fields
from app.features.words.repository_support import (
    apply_word_update_payload,
    record_word_level_change_if_needed,
)
from app.features.words.schemas import WordCreate, WordUpdate


def create_word_record(
    db,
    payload: WordCreate,
    *,
    commit: bool,
    word_cls=Word,
    assert_no_duplicate_word_fn,
    existing_normalized_terms_fn,
) -> Word:
    assert_no_duplicate_word_fn(payload.term, existing_normalized_terms_fn(db, payload.topic_ids))
    topics = _load_topics(db, payload.topic_ids)
    data = payload.model_dump(exclude={"topic_ids", "translation_entries", "example_entries"})
    word = word_cls(**data, topics=list(topics))
    sync_word_multivalue_fields(
        word,
        payload.translations,
        payload.translation_entries,
        payload.example,
        payload.example_entries,
    )
    db.add(word)
    _finalize_write(db, word, commit=commit)
    return word


def update_word_record(
    db,
    word: Word,
    payload: WordUpdate,
    *,
    commit: bool,
    record_level_change_fn,
    assert_no_duplicate_word_fn,
    existing_normalized_terms_fn,
) -> Word:
    effective_term = _effective_term(word, payload)
    target_topic_ids = _target_topic_ids(word, payload)
    if _requires_duplicate_check(word, payload, effective_term):
        assert_no_duplicate_word_fn(
            effective_term,
            existing_normalized_terms_fn(db, target_topic_ids, exclude_word_id=word.id),
        )

    old_level = word.knowledge_level
    apply_word_update_payload(db, word, payload)
    if payload.topic_ids is not None:
        word.topics = _load_topics(db, payload.topic_ids)

    record_word_level_change_if_needed(
        db,
        word,
        payload,
        old_level,
        record_level_change_fn=record_level_change_fn,
    )
    db.add(word)
    _finalize_write(db, word, commit=commit)
    return word


def soft_delete_word_record(db, word: Word) -> Word:
    word.deleted_at = datetime.now(timezone.utc)
    word.deleted_via_topic_id = None
    db.add(word)
    _finalize_write(db, word, commit=True)
    return word


def restore_word_record(db, word: Word) -> Word:
    word.deleted_at = None
    word.deleted_via_topic_id = None
    db.add(word)
    _finalize_write(db, word, commit=True)
    return word


def hard_delete_word_record(db, word: Word) -> None:
    db.delete(word)
    db.commit()


def _load_topics(db, topic_ids: list[int]) -> list[Topic]:
    return list(db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all())


def _finalize_write(db, word: Word, *, commit: bool) -> None:
    if commit:
        db.commit()
        db.refresh(word)
    else:
        db.flush()


def _effective_term(word: Word, payload: WordUpdate) -> str:
    data = payload.model_dump(exclude_unset=True, exclude={"topic_ids", "progress_source"})
    return data.get("term", word.term)


def _target_topic_ids(word: Word, payload: WordUpdate) -> list[int]:
    return payload.topic_ids if payload.topic_ids is not None else [int(topic.id) for topic in word.topics]


def _requires_duplicate_check(word: Word, payload: WordUpdate, effective_term: str) -> bool:
    data = payload.model_dump(exclude_unset=True, exclude={"topic_ids", "progress_source"})
    term_changed = "term" in data and effective_term != word.term
    topics_changed = payload.topic_ids is not None and set(payload.topic_ids) != {int(topic.id) for topic in word.topics}
    return term_changed or topics_changed
