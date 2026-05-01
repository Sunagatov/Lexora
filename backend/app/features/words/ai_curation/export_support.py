from __future__ import annotations

from datetime import datetime, timezone

from app.features.topics.repository import count_active_topics, list_active_topics_page_rows
from app.features.words.ai_curation.schemas import (
    AiCurationAllowedValues,
    AiCurationTopicListResponse,
    AiCurationTopicWordsLeanResponse,
    AiCurationTopicWordsResponse,
    PaginationMeta,
)
from app.features.words.ai_curation.export_mapping import (
    _source_topic_summary,
    _topic_summary_from_row,
    _word_to_export,
    _word_to_lean_export,
)
from app.features.words.ai_curation.export_queries import (
    _load_topic_words,
    _topic_words_count_stmt,
)
from app.features.words.model import Word, word_topics
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
    total = count_active_topics(db)
    offset = (page - 1) * page_size
    rows = list_active_topics_page_rows(
        db,
        offset=offset,
        page_size=page_size,
        word_cls=Word,
        word_topics_table=word_topics,
    )
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
