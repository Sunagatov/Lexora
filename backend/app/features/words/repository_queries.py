from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.features.topics.model import Topic
from app.features.words.model import (
    PartsOfSpeech,
    Word,
    WordExample,
    WordTranslation,
    WordVerbForm,
    word_topics,
)


def with_word_details(stmt):
    return stmt.options(
        selectinload(Word.part_of_speech),
        selectinload(Word.topics),
        selectinload(Word.verb_form),
        selectinload(Word.translation_items),
        selectinload(Word.example_items),
        selectinload(Word.synonym_items),
        selectinload(Word.antonym_items),
        selectinload(Word.collocation_items),
        selectinload(Word.confusable_items),
    )


def with_word_content_details(stmt):
    return stmt.options(
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
        | Word.definition.ilike(needle)
        | Word.pattern.ilike(needle)
        | Word.notes.ilike(needle)
    )


def ordered_word_stmt(stmt):
    return with_word_details(stmt).order_by(Word.term.asc(), Word.id.asc())


def apply_pos_filter(stmt, pos: str):
    return stmt.join(PartsOfSpeech, Word.part_of_speech_id == PartsOfSpeech.id).where(
        func.lower(PartsOfSpeech.name) == pos.strip().lower()
    )


def apply_cefr_filter(stmt, cefr: str):
    return stmt.where(Word.cefr_level == cefr.strip().upper())


def apply_level_filter(stmt, level: int):
    return stmt.where(Word.knowledge_level == level)


def apply_completeness_filter(stmt, completeness: str):
    has_definition = Word.definition.isnot(None) & (Word.definition != "")
    has_pos = Word.part_of_speech_id.isnot(None)
    has_translations = Word.id.in_(select(WordTranslation.word_id).distinct())
    has_examples = Word.id.in_(select(WordExample.word_id).distinct())
    if completeness == "complete":
        return stmt.where(has_definition & has_pos & has_translations & has_examples)
    return stmt.where(~(has_definition & has_pos & has_translations & has_examples))


def count_stmt(stmt):
    return select(func.count()).select_from(stmt.subquery())


def paginate_stmt(stmt, page: int, page_size: int):
    return stmt.offset((page - 1) * page_size).limit(page_size)
