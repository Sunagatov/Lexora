from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.features.topics.model import Topic
from app.features.words.model import Word, word_topics


def with_word_details(stmt):
    return stmt.options(
        selectinload(Word.topics),
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
