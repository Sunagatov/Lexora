from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select

from app.features.topics.model import Topic
from app.features.words.ai_curation.schemas import (
    AiCurationAllowedValues,
    AiCurationTopicListResponse,
    AiCurationTopicSummary,
    AiCurationTopicWordsLeanResponse,
    AiCurationTopicWordsResponse,
    AiCurationWord,
    AiCurationWordLean,
    PaginationMeta,
)
from app.features.words.enrichment import (
    EXAMPLE_TARGET_COUNT,
    example_count,
    example_enrichment_status,
    needs_example_enrichment,
)
from app.features.words.model import Word, WordExample, word_topics
from app.features.words.repository import _with_details
from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES

EXPORT_INSTRUCTIONS = [
    "Return valid JSON only. No markdown fences. No explanation.",
    "schema_version must be 'lexora.ai-curation.v2'.",
    "To enrich existing words: use word_updates — include only id and the fields to change.",
    "To add new words: use word_creates — include term, translations, and all applicable fields.",
    "To move words between topics: use word_reassigns.",
    "Skip words that already have 3 strong example sentences.",
    "Use only allowed countability and part_of_speech values from allowed_values.",
    "Do not create duplicates inside the same target topic.",
]


def list_topics_page(db, page: int, page_size: int) -> AiCurationTopicListResponse:
    total = db.scalar(select(func.count()).select_from(Topic).where(Topic.deleted_at.is_(None))) or 0
    offset = (page - 1) * page_size
    rows = db.execute(_topic_list_stmt(offset=offset, page_size=page_size)).all()
    return AiCurationTopicListResponse(
        items=[_topic_summary_from_row(row) for row in rows],
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
    )


def export_topic_words_page(
    db,
    topic,
    subtree_topic_ids: list[int],
    page: int,
    page_size: int,
) -> AiCurationTopicWordsResponse:
    total = db.scalar(_topic_words_count_stmt(subtree_topic_ids)) or 0
    words = _load_topic_words(
        db,
        subtree_topic_ids,
        page=page,
        page_size=page_size,
        needs_examples_only=False,
    )
    return AiCurationTopicWordsResponse(
        exported_at=datetime.now(timezone.utc),
        source_topic=_source_topic_summary(topic, total),
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
        allowed_values=AiCurationAllowedValues(
            countability=COUNTABILITY_VALUES,
            part_of_speech=PART_OF_SPEECH_VALUES,
        ),
        instructions=EXPORT_INSTRUCTIONS,
        words=[_word_to_export(word) for word in words],
    )


def export_topic_words_lean_page(
    db,
    topic,
    subtree_topic_ids: list[int],
    page: int,
    page_size: int,
    *,
    needs_examples_only: bool,
) -> AiCurationTopicWordsLeanResponse:
    total = db.scalar(_topic_words_count_stmt(subtree_topic_ids, needs_examples_only=needs_examples_only)) or 0
    words = _load_topic_words(
        db,
        subtree_topic_ids,
        page=page,
        page_size=page_size,
        needs_examples_only=needs_examples_only,
    )
    return AiCurationTopicWordsLeanResponse(
        source_topic_id=topic.id,
        exported_at=datetime.now(timezone.utc),
        total_words=total,
        words=[_word_to_lean_export(word) for word in words],
    )


def _topic_list_stmt(*, offset: int, page_size: int):
    return (
        select(
            Topic.id,
            Topic.name,
            Topic.slug,
            Topic.description,
            Topic.is_active,
            func.count(Word.id).label("word_count"),
        )
        .select_from(Topic)
        .outerjoin(word_topics, word_topics.c.topic_id == Topic.id)
        .outerjoin(Word, (Word.id == word_topics.c.word_id) & Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .group_by(Topic.id)
        .order_by(Topic.name.asc(), Topic.id.asc())
        .offset(offset)
        .limit(page_size)
    )


def _topic_words_count_stmt(subtree_topic_ids: list[int], *, needs_examples_only: bool = False):
    stmt = (
        select(func.count(func.distinct(Word.id)))
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
    )
    if needs_examples_only:
        stmt = stmt.where(_needs_examples_filter())
    return stmt


def _topic_words_stmt(subtree_topic_ids: list[int], *, needs_examples_only: bool):
    stmt = (
        select(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
        .distinct()
    )
    if needs_examples_only:
        stmt = stmt.where(_needs_examples_filter())
    return stmt


def _load_topic_words(
    db,
    subtree_topic_ids: list[int],
    *,
    page: int,
    page_size: int,
    needs_examples_only: bool,
) -> list[Word]:
    offset = (page - 1) * page_size
    stmt = (
        _topic_words_stmt(subtree_topic_ids, needs_examples_only=needs_examples_only)
        .order_by(Word.term.asc(), Word.id.asc())
        .offset(offset)
        .limit(page_size)
    )
    return list(db.scalars(_with_details(stmt)).all())


def _topic_summary_from_row(row) -> AiCurationTopicSummary:
    return AiCurationTopicSummary(
        id=int(row.id),
        name=str(row.name),
        slug=str(row.slug),
        description=row.description,
        is_active=bool(row.is_active),
        word_count=int(row.word_count),
    )


def _source_topic_summary(topic, total: int) -> AiCurationTopicSummary:
    return AiCurationTopicSummary(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        description=topic.description,
        is_active=topic.is_active,
        word_count=total,
    )


def _word_to_export(word: Word) -> AiCurationWord:
    example_count_value = example_count(word)
    return AiCurationWord(
        id=word.id,
        topic_ids=[int(topic.id) for topic in word.topics if topic.deleted_at is None],
        term=str(word.term),
        translations=str(word.translations),
        translation_entries=[item.value for item in getattr(word, "translation_items", [])],
        pattern=word.pattern,
        example_entries=[item.value for item in getattr(word, "example_items", [])],
        example_count=example_count_value,
        example_target_count=EXAMPLE_TARGET_COUNT,
        example_status=example_enrichment_status(example_count_value),
        needs_example_enrichment=needs_example_enrichment(word),
        countability=word.countability,
        part_of_speech=word.part_of_speech,
        past_simple=word.past_simple,
        past_participle=word.past_participle,
        notes=word.notes,
        knowledge_level=word.knowledge_level,
        is_active=word.is_active,
    )


def _word_to_lean_export(word: Word) -> AiCurationWordLean:
    count = example_count(word)
    return AiCurationWordLean(
        id=word.id,
        term=word.term,
        example_entries=[item.value for item in getattr(word, "example_items", [])] or None,
        example_count=count,
        example_target_count=EXAMPLE_TARGET_COUNT,
        example_status=example_enrichment_status(count),
        needs_example_enrichment=needs_example_enrichment(word),
    )


def _needs_examples_filter():
    complete_word_ids = (
        select(WordExample.word_id)
        .group_by(WordExample.word_id)
        .having(func.count(WordExample.id) >= EXAMPLE_TARGET_COUNT)
    )
    return Word.id.not_in(complete_word_ids)
