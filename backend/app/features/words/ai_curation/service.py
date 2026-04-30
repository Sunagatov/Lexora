from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.shared.logging_utils import log_audit_event
from app.features.topics.model import Topic
from app.features.topics.repository import get_active_subtree_topic_ids
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count, example_enrichment_status, needs_example_enrichment
from app.features.words.ai_curation import import_service as _import_service
from app.features.words.ai_curation.common import AiCurationImportError as _AiCurationImportError, _get_topic
from app.features.words.ai_curation.import_support import AiCurationImportOperations
from app.features.words.model import Word, WordExample, word_topics
from app.features.words.repository import _with_details
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
from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES

logger = logging.getLogger(__name__)

AiCurationImportError = _AiCurationImportError
InvalidTopicNameError = _import_service.InvalidTopicNameError
TopicSlugConflictError = _import_service.TopicSlugConflictError
DuplicateWordInTopicError = _import_service.DuplicateWordInTopicError
create_topic = _import_service.create_topic
create_word = _import_service.create_word
update_word = _import_service.update_word
_resolve_topic_ref = _import_service._resolve_topic_ref


def import_ai_curation(db: Session, payload):
    result = _import_service.import_ai_curation(
        db,
        payload,
        operations=AiCurationImportOperations(
            create_topic=create_topic,
            create_word=create_word,
            update_word=update_word,
            resolve_topic_ref=_resolve_topic_ref,
        ),
    )
    log_audit_event(
        "ai_curation.import",
        topic_id=result.source_topic_id,
        dry_run=result.dry_run,
        created_topics=len(result.created_topics),
        created_words=result.created_words,
        updated_words=result.updated_words,
        reassigned_words=result.reassigned_words,
        unchanged=result.unchanged,
    )
    return result


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


def list_topics_page(db: Session, page: int, page_size: int) -> AiCurationTopicListResponse:
    total = db.scalar(select(func.count()).select_from(Topic).where(Topic.deleted_at.is_(None))) or 0
    offset = (page - 1) * page_size

    rows = db.execute(
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
    ).all()

    items = [
        AiCurationTopicSummary(
            id=int(row.id),
            name=str(row.name),
            slug=str(row.slug),
            description=row.description,
            is_active=bool(row.is_active),
            word_count=int(row.word_count),
        )
        for row in rows
    ]
    return AiCurationTopicListResponse(
        items=items,
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
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


def _needs_examples_filter():
    complete_word_ids = (
        select(WordExample.word_id)
        .group_by(WordExample.word_id)
        .having(func.count(WordExample.id) >= EXAMPLE_TARGET_COUNT)
    )
    return Word.id.not_in(complete_word_ids)


def export_topic_words_page(db: Session, topic_id: int, page: int, page_size: int) -> AiCurationTopicWordsResponse:
    topic = _get_topic(db, topic_id)
    subtree_topic_ids = get_active_subtree_topic_ids(db, topic.id)

    total = db.scalar(
        select(func.count(func.distinct(Word.id)))
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
    ) or 0
    offset = (page - 1) * page_size

    words: list[Word] = list(
        db.scalars(
            _with_details(
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
        ).all()
    )

    source_topic = AiCurationTopicSummary(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        description=topic.description,
        is_active=topic.is_active,
        word_count=total,
    )

    return AiCurationTopicWordsResponse(
        exported_at=datetime.now(timezone.utc),
        source_topic=source_topic,
        pagination=PaginationMeta.build(page=page, page_size=page_size, total_items=total),
        allowed_values=AiCurationAllowedValues(
            countability=COUNTABILITY_VALUES,
            part_of_speech=PART_OF_SPEECH_VALUES,
        ),
        instructions=EXPORT_INSTRUCTIONS,
        words=[_word_to_export(word) for word in words],
    )


def export_topic_words_lean_page(
    db: Session,
    topic_id: int,
    page: int,
    page_size: int,
    *,
    needs_examples_only: bool = False,
) -> AiCurationTopicWordsLeanResponse:
    topic = _get_topic(db, topic_id)
    subtree_topic_ids = get_active_subtree_topic_ids(db, topic.id)
    needs_examples_filter = _needs_examples_filter() if needs_examples_only else None

    count_stmt = (
        select(func.count(func.distinct(Word.id)))
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
    )
    if needs_examples_filter is not None:
        count_stmt = count_stmt.where(needs_examples_filter)
    total = db.scalar(count_stmt) or 0
    offset = (page - 1) * page_size

    words_stmt = (
        select(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
        .distinct()
    )
    if needs_examples_filter is not None:
        words_stmt = words_stmt.where(needs_examples_filter)

    words = list(
        db.scalars(
            _with_details(
                words_stmt
                .order_by(Word.term.asc(), Word.id.asc())
                .offset(offset)
                .limit(page_size)
            )
        ).all()
    )

    lean_words = []
    for word in words:
        count = example_count(word)
        lean_words.append(
            AiCurationWordLean(
                id=word.id,
                term=word.term,
                example_entries=[item.value for item in getattr(word, "example_items", [])] or None,
                example_count=count,
                example_target_count=EXAMPLE_TARGET_COUNT,
                example_status=example_enrichment_status(count),
                needs_example_enrichment=needs_example_enrichment(word),
            )
        )

    return AiCurationTopicWordsLeanResponse(
        source_topic_id=topic.id,
        exported_at=datetime.now(timezone.utc),
        total_words=total,
        words=lean_words,
    )
