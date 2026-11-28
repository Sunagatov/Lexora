from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, event, null
from sqlalchemy.orm import Session

from app.features.languages.catalog import configure_language
from app.features.stats.recall import RecallBatch
from app.features.stats.router import get_recall_attempts, get_recall_due, post_recall_attempts
from app.features.words.model import Word, WordTranslation
from app.shared.db import Base


@pytest.fixture
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    event.listen(engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def translated_word(term, *, targets=("ru",), **fields):
    return Word(term=term, translation_items=[
        WordTranslation(position=0, language=target, value=f"{target} answer") for target in targets
    ], **fields)


def attempt(word, occurred_at, *, recalled, target="ru"):
    return {
        "id": str(uuid4()),
        "word_id": word.id,
        "language": word.language,
        "translation_language": target,
        "occurred_at": occurred_at,
        "recalled": recalled,
    }


def submit(db, *attempts):
    return post_recall_attempts(RecallBatch.model_validate({"attempts": attempts}), db)


def test_recall_replays_preserve_a_single_attempt_with_the_original_utc_time(db):
    word = translated_word("rail", knowledge_level=3)
    db.add(word)
    db.commit()
    occurred_at = datetime(2026, 1, 13, 20, 32, 10, tzinfo=UTC)
    entry = attempt(word, occurred_at, recalled=True)
    offset = timezone(timedelta(hours=3))
    same_entry = {**entry, "occurred_at": occurred_at.astimezone(offset).isoformat()}
    expected = {"accepted_ids": [entry["id"]], "discarded_ids": []}

    assert submit(db, entry, same_entry) == expected
    assert submit(db, same_entry) == expected
    assert get_recall_attempts(db) == {"attempts": [entry]}
    assert word.knowledge_level == 3


def test_conflicting_recall_id_does_not_commit_unrelated_attempts_in_the_batch(db):
    word = translated_word("rail")
    db.add(word)
    db.commit()
    now = datetime.now(UTC)
    first = attempt(word, now, recalled=True)
    second = attempt(word, now - timedelta(days=1), recalled=False)
    submit(db, first)

    with pytest.raises(HTTPException) as conflict:
        submit(db, second, {**first, "recalled": False})
    assert conflict.value.status_code == 409
    assert get_recall_attempts(db) == {"attempts": [first]}
    assert submit(db, second)["accepted_ids"] == [second["id"]]
    assert get_recall_attempts(db) == {"attempts": [second, first]}


def test_due_practice_uses_chronological_history_then_weak_and_unrated_words(db):
    now = datetime.now(UTC)
    overdue = translated_word("overdue", knowledge_level=4)
    reset_by_late_miss = translated_word("reset by late miss", knowledge_level=4)
    parked = translated_word("parked", knowledge_level=5)
    archived = translated_word("archived", knowledge_level=1, deleted_at=now)
    fresh = [
        translated_word(f"new {index:02}", knowledge_level=null() if index == 0 else 1)
        for index in range(12)
    ]
    db.add_all([
        overdue, reset_by_late_miss, parked, archived, *fresh,
        translated_word("no Russian answer", targets=("en",), knowledge_level=1),
    ])
    db.commit()
    submit(
        db,
        attempt(reset_by_late_miss, now - timedelta(days=2), recalled=True),
        attempt(reset_by_late_miss, now - timedelta(days=4), recalled=True),
        attempt(overdue, now - timedelta(days=7), recalled=False),
        attempt(parked, now - timedelta(days=7), recalled=False),
        attempt(archived, now - timedelta(days=7), recalled=False),
    )
    assert [word.term for word in get_recall_due(db)] == [
        "overdue", *(f"new {index:02}" for index in range(9)),
    ]

    submit(db, attempt(reset_by_late_miss, now - timedelta(days=3), recalled=False))
    assert [word.term for word in get_recall_due(db)] == [
        "overdue", "reset by late miss", *(f"new {index:02}" for index in range(8)),
    ]


def test_recall_scopes_history_and_due_words_and_acknowledges_purged_ids(db):
    english = translated_word("rail", targets=("en", "ru"), knowledge_level=4)
    spanish = translated_word("tren", language="es", knowledge_level=4)
    db.add_all([english, spanish])
    db.commit()
    now = datetime.now(UTC)
    old_russian = attempt(english, now - timedelta(days=2), recalled=True)
    recent_english = attempt(english, now - timedelta(hours=1), recalled=True, target="en")
    spanish_recall = attempt(spanish, now - timedelta(days=2), recalled=False)

    assert submit(db, old_russian, recent_english, spanish_recall)["accepted_ids"] == [
        entry["id"] for entry in (old_russian, recent_english, spanish_recall)
    ]
    assert get_recall_attempts(db) == {"attempts": [old_russian]}
    assert [word.term for word in get_recall_due(db)] == ["rail"]

    configure_language(db, "en", "en")
    assert get_recall_attempts(db) == {"attempts": [recent_english]}
    assert get_recall_due(db) == []
    configure_language(db, "es", "ru")
    assert get_recall_attempts(db) == {"attempts": [spanish_recall]}
    assert [word.term for word in get_recall_due(db)] == ["tren"]

    db.execute(delete(Word).where(Word.id == spanish.id))
    db.commit()
    assert submit(db, spanish_recall) == {"accepted_ids": [], "discarded_ids": [spanish_recall["id"]]}
    assert get_recall_attempts(db) == {"attempts": []}
