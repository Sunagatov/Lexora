from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.repository import get_word_by_id_including_deleted
from app.features.words.workbook.format import PART_OF_SPEECH_VALUES, InvalidWorkbookError
from app.shared.constraints import TOPIC_NAME_MAX_LEN
from app.shared.text import normalize_term


def _should_validate_existing_word_duplicate(
    existing: Word,
    term: str,
    topic_was_missing: bool,
) -> bool:
    return topic_was_missing or normalize_term(term) != normalize_term(existing.term)


def _normalize_part_of_speech(
    raw_value: str | None,
    countability: str | None,
    past_simple: str | None,
    past_participle: str | None,
    existing_value: str | None = None,
) -> str | None:
    if raw_value and raw_value.strip():
        return raw_value.strip().lower()
    if existing_value:
        return existing_value
    if past_simple or past_participle:
        return "verb"
    if countability:
        return "noun"
    return None


def _validate_part_of_speech(value: str | None, sheet_name: str, row_idx: int) -> str | None:
    normalized = value.strip().lower() if value and value.strip() else None
    if normalized is not None and normalized not in PART_OF_SPEECH_VALUES:
        allowed = ", ".join(PART_OF_SPEECH_VALUES)
        raise InvalidWorkbookError(
            f"{sheet_name}, row {row_idx}: part of speech must be blank or one of: {allowed}"
        )
    return normalized


def _get_topic(db: Session, topic_name: str, topic_id: int | None = None) -> Topic:
    if topic_id is not None:
        topic: Topic | None = db.scalar(
            select(Topic).where(Topic.id == topic_id).where(Topic.deleted_at.is_(None))
        )
        if topic is not None:
            return topic

        deleted: Topic | None = db.scalar(
            select(Topic).where(Topic.id == topic_id).where(Topic.deleted_at.isnot(None))
        )
        if deleted is not None:
            raise InvalidWorkbookError(
                f"Workbook references topic id {topic_id}, but that topic is currently in Trash."
            )

        raise InvalidWorkbookError(
            f"Workbook references unknown topic id {topic_id}. "
            "Re-export the workbook from Lexora before importing."
        )

    if len(topic_name) > TOPIC_NAME_MAX_LEN:
        raise InvalidWorkbookError(
            f"Topic name '{topic_name}' is too long; maximum is {TOPIC_NAME_MAX_LEN} characters."
        )

    topic: Topic | None = db.scalar(select(Topic).where(Topic.name == topic_name).where(Topic.deleted_at.is_(None)))
    if topic is not None:
        return topic

    deleted: Topic | None = db.scalar(select(Topic).where(Topic.name == topic_name).where(Topic.deleted_at.isnot(None)))
    if deleted is not None:
        raise InvalidWorkbookError(
            f"Workbook references topic '{topic_name}', but that topic is currently in Trash."
        )

    raise InvalidWorkbookError(
        f"Workbook references unknown topic '{topic_name}'. "
        "Import only exported Lexora sheets for existing topics; create new topics in Lexora before importing."
    )


def _find_existing_word(db: Session, topic_id: int, word_id: int | None, term: str) -> Word | None:
    if word_id is not None:
        word = get_word_by_id_including_deleted(db, word_id)
        if word is None:
            raise InvalidWorkbookError(f"Workbook references unknown word id {word_id}")
        if word.deleted_at is not None:
            raise InvalidWorkbookError(f"Workbook references deleted word id {word_id}")
        if topic_id not in {topic.id for topic in word.topics}:
            raise InvalidWorkbookError(
                f"Workbook references word id {word_id} on the wrong topic sheet. "
                "Keep existing Word IDs only on their exported sheets; leave Word ID blank for new rows."
            )
        return word

    candidates: list[Word] = list(
        db.scalars(
            select(Word)
            .options(
                selectinload(Word.topics),
                selectinload(Word.translation_items),
                selectinload(Word.example_items),
            )
            .where(Word.deleted_at.is_(None))
            .where(Word.topics.any(Topic.id == topic_id))
        ).all()
    )

    normalized = normalize_term(term)
    for candidate in candidates:
        if normalize_term(candidate.term) == normalized:
            return candidate
    return None
