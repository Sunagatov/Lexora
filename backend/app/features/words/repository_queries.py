from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import load_only, selectinload

from app.features.topics.model import Topic
from app.features.words.model import Word, word_topics


def _word_base_columns():
    return (
        Word.id,
        Word.term,
        Word.past_simple,
        Word.past_participle,
        Word.translations,
        Word.part_of_speech,
        Word.knowledge_level,
        Word.countability,
        Word.pattern,
        Word.example,
        Word.notes,
        Word.is_active,
        Word.created_at,
        Word.updated_at,
        Word.deleted_at,
        Word.deleted_via_topic_id,
    )


def with_word_details(stmt):
    return stmt.options(
        load_only(*_word_base_columns()),
        selectinload(Word.topics).load_only(Topic.id, Topic.deleted_at),
        selectinload(Word.translation_items),
        selectinload(Word.example_items),
    )


def with_word_content_details(stmt):
    return stmt.options(
        load_only(*_word_base_columns()),
        selectinload(Word.translation_items),
        selectinload(Word.example_items),
    )


def active_words_stmt():
    return select(Word).where(Word.deleted_at.is_(None))


def words_for_topics_stmt(topic_ids: list[int]):
    return (
        active_words_stmt()
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Topic.id.in_(topic_ids))
        .where(Topic.deleted_at.is_(None))
        .distinct()
    )


def apply_word_search(stmt, search: str):
    needle = f"%{search}%"
    return stmt.where(
        Word.term.ilike(needle)
        | Word.translations.ilike(needle)
        | Word.pattern.ilike(needle)
        | Word.example.ilike(needle)
        | Word.notes.ilike(needle)
        | Word.past_simple.ilike(needle)
        | Word.past_participle.ilike(needle)
    )


def ordered_word_stmt(stmt):
    return with_word_details(stmt).order_by(Word.term.asc(), Word.id.asc())
