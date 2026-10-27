from __future__ import annotations

from sqlalchemy import case, func, select
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
    word_ids = (
        select(word_topics.c.word_id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Topic.id.in_(topic_ids))
        .where(Topic.deleted_at.is_(None))
        .distinct()
    )
    return active_words_stmt().where(Word.id.in_(word_ids))


def apply_word_search(stmt, search: str, target: str = "ru"):
    needle = f"%{search}%"
    definition = Word.explanation_groups["en"]["definition"].as_string() if target == "en" else Word.definition
    notes = Word.explanation_groups["en"]["notes"].as_string() if target == "en" else Word.notes
    return stmt.where(
        Word.term.ilike(needle)
        | definition.ilike(needle)
        | Word.transliteration.ilike(needle)
        | Word.pattern.ilike(needle)
        | notes.ilike(needle)
        | Word.id.in_(select(WordTranslation.word_id).where(WordTranslation.value.ilike(needle), WordTranslation.language == target))
        | Word.id.in_(select(WordExample.word_id).where(WordExample.value.ilike(needle)))
        | Word.id.in_(select(WordVerbForm.word_id).where(
            WordVerbForm.past_simple.ilike(needle) | WordVerbForm.past_participle.ilike(needle)
        ))
    )


def ordered_word_stmt(stmt, sort: str = "term-asc", then_sort: str | None = None):
    # Parked and unrated words stay behind the active learning levels.
    level = case((Word.knowledge_level == 5, 98), else_=func.coalesce(Word.knowledge_level, 99))
    descending_level = case(
        (Word.knowledge_level == 5, 98),
        (Word.knowledge_level.is_(None), 99),
        else_=5 - Word.knowledge_level,
    )
    cefr = case(
        {value: index for index, value in enumerate(("A1", "A2", "B1", "B2", "C1", "C2"), 1)},
        value=Word.cefr_level, else_=99,
    )
    orders = {
        "term-asc": [Word.term.asc()],
        "term-desc": [func.lower(Word.term).desc()],
        "level-asc": [level.asc()],
        "level-desc": [descending_level.asc()],
        "cefr-asc": [cefr.asc()],
        "cefr-desc": [case((Word.cefr_level.is_(None), 1), else_=0).asc(), cefr.desc()],
        "newest": [Word.created_at.desc()],
        "oldest": [Word.created_at.asc()],
    }
    secondary = then_sort if then_sort is not None else ("cefr-asc" if sort.startswith("level-") else "none")
    order = [*orders[sort], *(orders[secondary] if secondary != "none" else [])]
    return with_word_details(stmt).order_by(*order, func.lower(Word.term).asc(), Word.id.asc())


def apply_pos_filter(stmt, pos: str | list[str]):
    positions = [pos] if isinstance(pos, str) else pos
    return stmt.join(PartsOfSpeech, Word.part_of_speech_id == PartsOfSpeech.id).where(
        func.lower(PartsOfSpeech.name).in_([value.strip().lower() for value in positions])
    )


def apply_cefr_filter(stmt, cefr: str | list[str]):
    values = [cefr] if isinstance(cefr, str) else cefr
    return stmt.where(Word.cefr_level.in_([value.strip().upper() for value in values]))


def apply_level_filter(stmt, level: int | list[int]):
    return stmt.where(Word.knowledge_level.in_([level] if isinstance(level, int) else level))


def apply_completeness_filter(stmt, completeness: str, target: str = "ru"):
    definition = Word.explanation_groups["en"]["definition"].as_string() if target == "en" else Word.definition
    has_definition = definition.isnot(None) & (definition != "")
    has_pos = Word.part_of_speech_id.isnot(None)
    has_translations = Word.id.in_(select(WordTranslation.word_id).where(WordTranslation.language == target).distinct())
    has_examples = Word.id.in_(select(WordExample.word_id).distinct())
    if completeness == "complete":
        return stmt.where(has_definition & has_pos & has_translations & has_examples)
    return stmt.where(~(has_definition & has_pos & has_translations & has_examples))


def count_stmt(stmt):
    return select(func.count()).select_from(stmt.subquery())


def paginate_stmt(stmt, page: int, page_size: int):
    return stmt.offset((page - 1) * page_size).limit(page_size)
