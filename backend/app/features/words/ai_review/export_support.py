from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.features.topics.model import Topic
from app.features.words.ai_review.schemas import (
    AiReviewAllowedValues,
    AiReviewExportResponse,
    AiReviewPagination,
    AiReviewTopic,
    AiReviewWord,
)
from app.features.words.model import Word, word_topics
from app.features.words.repository import _with_details
from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES

EXPORT_INSTRUCTIONS = [
    "Return the same JSON shape and schema_version.",
    "Only enrich existing words from this topic; do not add, remove, rename, or duplicate words.",
    "Keep every word id and term unchanged.",
    "Use example_entries for examples; keep each example as one string.",
    "Use only allowed countability and part_of_speech values already present in the JSON.",
]


def build_topic_ai_review_export(
    db,
    topic,
    subtree_topic_ids: list[int],
    page: int,
    page_size: int,
) -> AiReviewExportResponse:
    total_words = db.scalar(_topic_words_count_stmt(subtree_topic_ids)) or 0
    total_pages = max(1, math.ceil(total_words / page_size))
    words = _load_topic_words(
        db,
        subtree_topic_ids,
        page=page,
        page_size=page_size,
    )
    return AiReviewExportResponse(
        exported_at=datetime.now(timezone.utc),
        topic_id=topic.id,
        topic=AiReviewTopic(id=topic.id, name=topic.name),
        pagination=AiReviewPagination(
            page=page,
            page_size=page_size,
            total_words=total_words,
            total_pages=total_pages,
        ),
        allowed_values=AiReviewAllowedValues(
            countability=COUNTABILITY_VALUES,
            part_of_speech=PART_OF_SPEECH_VALUES,
        ),
        instructions=EXPORT_INSTRUCTIONS,
        words=[_word_to_ai_review_word(word) for word in words],
    )


def _topic_words_count_stmt(subtree_topic_ids: list[int]):
    return (
        select(func.count(func.distinct(Word.id)))
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
    )


def _load_topic_words(db, subtree_topic_ids: list[int], *, page: int, page_size: int) -> list[Word]:
    offset = (page - 1) * page_size
    stmt = (
        select(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
        .distinct()
        .order_by(Word.term.asc(), Word.id.asc())
        .offset(offset)
        .limit(page_size)
    )
    return list(db.scalars(_with_details(stmt)).all())


def _word_to_ai_review_word(word: Word) -> AiReviewWord:
    return AiReviewWord(
        id=word.id,
        term=word.term,
        translations=word.translations,
        translation_entries=[item.value for item in getattr(word, "translation_items", [])],
        pattern=word.pattern,
        example_entries=[item.value for item in getattr(word, "example_items", [])],
        countability=word.countability,
        part_of_speech=word.part_of_speech,
        past_simple=word.past_simple,
        past_participle=word.past_participle,
        notes=word.notes,
        knowledge_level=word.knowledge_level,
    )
