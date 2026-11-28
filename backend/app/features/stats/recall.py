from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PositiveInt,
    StrictBool,
    field_validator,
)
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.features.languages.catalog import (
    Language,
    TranslationLanguage,
    learning_language,
    translation_language,
)
from app.features.stats.recall_model import RecallAttempt
from app.features.words.api import with_word_details
from app.features.words.model import Word, WordTranslation
from app.features.words.schemas import WordResponse

PRACTICE_SIZE = 10
RECALL_INTERVALS = (1, 3, 7, 14, 30)


class RecallEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    word_id: PositiveInt
    language: Language
    translation_language: TranslationLanguage
    occurred_at: AwareDatetime
    recalled: StrictBool

    @field_validator("occurred_at")
    @classmethod
    def normalize_time(cls, value: datetime) -> datetime:
        try:
            return value.astimezone(UTC)
        except OverflowError as exc:
            raise ValueError("The recall timestamp must have a representable UTC time") from exc


class RecallBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempts: list[RecallEvent] = Field(max_length=100)


def _as_utc(occurred_at: datetime) -> datetime:
    # SQLite returns naive datetimes for columns holding UTC.
    if occurred_at.tzinfo is None:
        return occurred_at.replace(tzinfo=UTC)
    return occurred_at.astimezone(UTC)


def _attempt_payload(attempt: RecallAttempt) -> dict:
    return {
        "id": attempt.id,
        "word_id": attempt.word_id,
        "language": attempt.language,
        "translation_language": attempt.translation_language,
        "occurred_at": _as_utc(attempt.occurred_at),
        "recalled": attempt.recalled,
    }


def _conflicting_id() -> HTTPException:
    return HTTPException(409, "A recall attempt ID was reused with different content")


def save_recall_attempts(db: Session, batch: RecallBatch) -> dict[str, list[str]]:
    attempts = {}
    for event in batch.attempts:
        event_id = str(event.id)
        row = event.model_dump()
        row["id"] = event_id
        if attempts.setdefault(event_id, row) != row:
            raise _conflicting_id()
    if not attempts:
        return {"accepted_ids": [], "discarded_ids": []}

    try:
        stored = {event.id: event for event in db.scalars(
            select(RecallAttempt).where(RecallAttempt.id.in_(attempts))
        )}
        for event_id, event in stored.items():
            if _attempt_payload(event) != attempts[event_id]:
                raise _conflicting_id()
        pending = {event_id: event for event_id, event in attempts.items() if event_id not in stored}
        # Keep a concurrent purge from invalidating the FK between validation and insertion.
        word_languages = dict(db.execute(
            select(Word.id, Word.language)
            .where(Word.id.in_({row["word_id"] for row in pending.values()}))
            .order_by(Word.id)
            .with_for_update(read=True, key_share=True)
        ).all()) if pending else {}
        discarded = set()
        new_rows = []
        for event_id, row in sorted(pending.items()):
            word_language = word_languages.get(row["word_id"])
            if word_language is None:
                discarded.add(event_id)
            elif word_language != row["language"]:
                raise HTTPException(422, "The learning language does not match the recall word")
            else:
                new_rows.append(row)
        if new_rows:
            insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
            db.execute(insert(RecallAttempt).values(new_rows).on_conflict_do_nothing(index_elements=[RecallAttempt.id]))
            # A concurrent device can write the same IDs between SELECT and INSERT.
            inserted = db.scalars(select(RecallAttempt).where(RecallAttempt.id.in_([row["id"] for row in new_rows])))
            for event in inserted:
                if _attempt_payload(event) != attempts[event.id]:
                    raise _conflicting_id()
        db.commit()
    except (HTTPException, SQLAlchemyError):
        db.rollback()
        raise
    return {
        "accepted_ids": [key for key in attempts if key not in discarded],
        "discarded_ids": [key for key in attempts if key in discarded],
    }


def get_recall_history(db: Session) -> dict[str, list[dict]]:
    history = db.scalars(
        select(RecallAttempt)
        .where(
            RecallAttempt.language == learning_language(db),
            RecallAttempt.translation_language == translation_language(db),
        )
        .order_by(RecallAttempt.occurred_at, RecallAttempt.id)
    )
    return {"attempts": [_attempt_payload(attempt) for attempt in history]}


def get_due_recall_words(db: Session) -> list[WordResponse]:
    language = learning_language(db)
    target = translation_language(db)
    now = datetime.now(UTC)
    word_scope = (
        Word.language == language,
        Word.deleted_at.is_(None),
        Word.is_active.is_(True),
        or_(Word.knowledge_level.is_(None), Word.knowledge_level != 5),
        Word.translation_items.any(WordTranslation.language == target),
    )
    recall_scope = (
        RecallAttempt.language == language,
        RecallAttempt.translation_language == target,
    )
    last_by_word: dict[int, tuple[int, datetime]] = {}
    rows = db.execute(
        select(RecallAttempt.word_id, RecallAttempt.recalled, RecallAttempt.occurred_at)
        .join(Word, Word.id == RecallAttempt.word_id)
        .where(*word_scope, *recall_scope, RecallAttempt.occurred_at <= now)
        .order_by(RecallAttempt.occurred_at, RecallAttempt.id)
    )
    for word_id, recalled, occurred_at in rows:
        previous = last_by_word.get(word_id)
        consecutive = 0
        if recalled:
            consecutive = (previous[0] if previous else 0) + 1
        interval = RECALL_INTERVALS[min(max(consecutive - 1, 0), len(RECALL_INTERVALS) - 1)]
        last_by_word[word_id] = (consecutive, _as_utc(occurred_at) + timedelta(days=interval))

    overdue = sorted((due_at, word_id) for word_id, (_, due_at) in last_by_word.items() if due_at <= now)
    word_ids = [word_id for _, word_id in overdue[:PRACTICE_SIZE]]
    remaining = PRACTICE_SIZE - len(word_ids)
    if remaining:
        has_recall = select(RecallAttempt.id).where(RecallAttempt.word_id == Word.id, *recall_scope).exists()
        word_ids.extend(db.scalars(
            select(Word.id)
            .where(*word_scope, or_(Word.knowledge_level == 1, Word.knowledge_level.is_(None)), ~has_recall)
            .order_by(Word.term, Word.id)
            .limit(remaining)
        ))
    if not word_ids:
        return []
    by_id = {word.id: word for word in db.scalars(
        with_word_details(select(Word).where(Word.id.in_(word_ids), *word_scope))
    )}
    return [WordResponse.from_word(by_id[word_id]) for word_id in word_ids if word_id in by_id]
