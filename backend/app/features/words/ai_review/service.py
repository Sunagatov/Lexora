from __future__ import annotations

import math
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.words.ai_review.schemas import (
    AiReviewAllowedValues,
    AiReviewExportResponse,
    AiReviewImportRequest,
    AiReviewImportResponse,
    AiReviewPagination,
    AiReviewTopic,
    AiReviewWord,
)
from app.features.words.model import Word
from app.features.words.repository import _with_details, update_word
from app.features.words.schemas import WordUpdate
from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES

EXPORT_INSTRUCTIONS = [
    "Return the same JSON shape and schema_version.",
    "Only enrich existing words from this topic; do not add, remove, rename, or duplicate words.",
    "Keep every word id and term unchanged.",
    "Use example_entries for examples; keep each example as one string.",
    "Use only allowed countability and part_of_speech values already present in the JSON.",
]


class AiReviewImportError(Exception):
    pass


def _get_topic(db: Session, topic_id: int) -> Topic:
    topic = db.scalar(select(Topic).where(Topic.id == topic_id, Topic.deleted_at.is_(None)))
    if topic is None:
        raise AiReviewImportError(f"Topic {topic_id} not found")
    return topic


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


def build_topic_ai_review_export(
    db: Session,
    topic_id: int,
    page: int,
    page_size: int,
) -> AiReviewExportResponse:
    topic = _get_topic(db, topic_id)
    topic_filter = Word.topics.any((Topic.id == topic.id) & Topic.deleted_at.is_(None))
    total_words = db.scalar(
        select(func.count()).select_from(Word).where(Word.deleted_at.is_(None), topic_filter)
    ) or 0
    total_pages = max(1, math.ceil(total_words / page_size))
    offset = (page - 1) * page_size

    words = list(db.scalars(
        _with_details(
            select(Word)
            .where(Word.deleted_at.is_(None), topic_filter)
            .order_by(Word.term.asc(), Word.id.asc())
            .offset(offset)
            .limit(page_size)
        )
    ).all())

    return AiReviewExportResponse(
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


def _load_import_words(db: Session, topic_id: int, word_ids: list[int]) -> dict[int, Word]:
    words = db.scalars(
        _with_details(
            select(Word)
            .where(Word.id.in_(word_ids), Word.deleted_at.is_(None))
            .where(Word.topics.any((Topic.id == topic_id) & Topic.deleted_at.is_(None)))
        )
    ).all()
    return {word.id: word for word in words}


def _assert_unique_word_ids(word_ids: list[int]) -> None:
    duplicates = sorted(word_id for word_id, count in Counter(word_ids).items() if count > 1)
    if duplicates:
        raise AiReviewImportError(f"Duplicate word ids in payload: {duplicates}")


def _current_value(word: Word, field: str):
    if field == "translation_entries":
        return [item.value for item in getattr(word, "translation_items", [])]
    if field == "example_entries":
        return [item.value for item in getattr(word, "example_items", [])]
    return getattr(word, field)


def _has_changes(word: Word, item) -> bool:
    for field in item.model_fields_set - {"id", "term"}:
        if getattr(item, field) != _current_value(word, field):
            return True
    return False


def _build_update_payload(item) -> WordUpdate:
    data = item.model_dump(exclude_unset=True, exclude={"id", "term"})
    data["progress_source"] = "json_import"
    return WordUpdate(**data)


def import_topic_ai_review(db: Session, payload: AiReviewImportRequest) -> AiReviewImportResponse:
    topic = _get_topic(db, payload.topic_id)
    word_ids = [word.id for word in payload.words]
    _assert_unique_word_ids(word_ids)

    words_by_id = _load_import_words(db, topic.id, word_ids)
    missing_ids = sorted(set(word_ids) - set(words_by_id))
    if missing_ids:
        raise AiReviewImportError(
            f"These word ids do not exist in topic '{topic.name}': {missing_ids}"
        )

    updated_ids: list[int] = []
    unchanged = 0
    try:
        for item in payload.words:
            word = words_by_id[item.id]
            if item.term != word.term:
                raise AiReviewImportError(
                    f"Word {item.id} term mismatch: expected '{word.term}', got '{item.term}'"
                )

        for item in payload.words:
            word = words_by_id[item.id]
            if not _has_changes(word, item):
                unchanged += 1
                continue
            update_payload = _build_update_payload(item)
            updated_ids.append(word.id)
            if not payload.dry_run:
                update_word(db, word, update_payload)
    except Exception:
        db.rollback()
        raise

    return AiReviewImportResponse(
        topic_id=topic.id,
        topic_name=topic.name,
        dry_run=payload.dry_run,
        updated=len(updated_ids),
        unchanged=unchanged,
        updated_word_ids=updated_ids,
    )
