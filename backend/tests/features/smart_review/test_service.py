from datetime import datetime, timedelta, timezone
import logging
from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.features.topics.model  # noqa: F401 — registers Topic in SQLAlchemy's class registry
import app.features.stats.model  # noqa: F401 — registers WordProgressEvent in SQLAlchemy's class registry
import app.features.words.model  # noqa: F401 — registers Word in SQLAlchemy's class registry

import pytest

from app.shared.db import Base
from app.features.smart_review import service as smart_review_service


class FakeDB:
    def __init__(self):
        self.added = []
        self.committed = False
        self.refreshed = []

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if isinstance(obj, smart_review_service.StudyQueue) and obj.id is None:
                obj.id = 123

    def commit(self):
        self.committed = True

    def refresh(self, obj):
        self.refreshed.append(obj)


def _make_sqlite_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_complete_queue_item_raises_when_item_missing() -> None:
    db = MagicMock()
    db.get.side_effect = lambda model, object_id: None

    with pytest.raises(smart_review_service.QueueItemNotFoundError):
        smart_review_service.complete_queue_item(db, 999)


def test_complete_queue_item_raises_when_queue_is_missing_or_inactive() -> None:
    item = SimpleNamespace(queue_id=5, is_completed=False, completed_at=None)

    db = MagicMock()

    def fake_get(model, object_id):
        if model is smart_review_service.StudyQueueItem:
            return item
        if model is smart_review_service.StudyQueue:
            return None
        return None

    db.get.side_effect = fake_get

    with pytest.raises(smart_review_service.QueueNotActiveError):
        smart_review_service.complete_queue_item(db, 10)


def test_complete_queue_item_raises_when_queue_is_expired() -> None:
    item = SimpleNamespace(queue_id=5, is_completed=False, completed_at=None)
    past = datetime(2020, 1, 1, tzinfo=timezone.utc)
    queue = SimpleNamespace(
        is_active=True,
        completed_count=0,
        expires_at=past,
    )

    db = MagicMock()

    def fake_get(model, object_id):
        if model is smart_review_service.StudyQueueItem:
            return item
        if model is smart_review_service.StudyQueue:
            return queue
        return None

    db.get.side_effect = fake_get

    with pytest.raises(smart_review_service.QueueNotActiveError):
        smart_review_service.complete_queue_item(db, 10)


def test_complete_queue_item_marks_incomplete_item_as_done() -> None:
    item = SimpleNamespace(queue_id=5, word_id=10, is_completed=False, completed_at=None)
    queue = SimpleNamespace(
        is_active=True,
        completed_count=1,
        expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
    )
    word = SimpleNamespace(id=10, deleted_at=None, is_active=True)

    db = MagicMock()

    def fake_get(model, object_id):
        if model is smart_review_service.StudyQueueItem:
            return item
        if model is smart_review_service.StudyQueue:
            return queue
        if model is smart_review_service.Word:
            return word
        return None

    db.get.side_effect = fake_get

    result = smart_review_service.complete_queue_item(db, 10)

    assert result is queue
    assert item.is_completed is True
    assert item.completed_at is not None
    assert queue.completed_count == 2
    db.commit.assert_called_once()


def test_complete_queue_item_writes_audit_log(caplog) -> None:
    item = SimpleNamespace(id=10, queue_id=5, word_id=10, is_completed=False, completed_at=None)
    queue = SimpleNamespace(
        id=5,
        is_active=True,
        completed_count=1,
        total_count=4,
        expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
    )
    word = SimpleNamespace(id=10, deleted_at=None, is_active=True)

    db = MagicMock()

    def fake_get(model, object_id):
        if model is smart_review_service.StudyQueueItem:
            return item
        if model is smart_review_service.StudyQueue:
            return queue
        if model is smart_review_service.Word:
            return word
        return None

    db.get.side_effect = fake_get

    with caplog.at_level(logging.INFO, logger="audit"):
        smart_review_service.complete_queue_item(db, 10)

    matching = [
        r for r in caplog.records
        if r.name == "audit" and r.message == "smart_review.item.completed"
    ]
    assert matching
    assert matching[0].queue_id == 5
    assert matching[0].word_id == 10


def test_complete_queue_item_does_not_commit_when_already_completed() -> None:
    item = SimpleNamespace(queue_id=5, word_id=10, is_completed=True, completed_at="already")
    queue = SimpleNamespace(
        is_active=True,
        completed_count=3,
        expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
    )
    word = SimpleNamespace(id=10, deleted_at=None, is_active=True)

    db = MagicMock()

    def fake_get(model, object_id):
        if model is smart_review_service.StudyQueueItem:
            return item
        if model is smart_review_service.StudyQueue:
            return queue
        if model is smart_review_service.Word:
            return word
        return None

    db.get.side_effect = fake_get

    result = smart_review_service.complete_queue_item(db, 10)

    assert result is queue
    db.commit.assert_not_called()


def test_get_or_create_active_queue_returns_none_when_feature_disabled(monkeypatch) -> None:
    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", False)

    result = smart_review_service.get_or_create_active_queue(MagicMock())

    assert result is None


def test_get_or_create_active_queue_returns_existing_incomplete_queue(monkeypatch) -> None:
    active_word = SimpleNamespace(deleted_at=None, is_active=True)
    queue = SimpleNamespace(
        is_active=True,
        completed_count=1,
        total_count=3,
        items=[
            SimpleNamespace(word=active_word),
            SimpleNamespace(word=active_word),
            SimpleNamespace(word=active_word),
        ],
    )
    db = MagicMock()
    db.scalar.return_value = queue

    generate = MagicMock()
    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_service, "generate_queue", generate)

    result = smart_review_service.get_or_create_active_queue(db)

    assert result is queue
    generate.assert_not_called()


def test_get_or_create_active_queue_regenerates_when_existing_queue_is_complete(monkeypatch) -> None:
    active_word = SimpleNamespace(deleted_at=None, is_active=True)
    queue = SimpleNamespace(
        is_active=True,
        completed_count=3,
        total_count=3,
        items=[SimpleNamespace(word=active_word), SimpleNamespace(word=active_word), SimpleNamespace(word=active_word)],
    )
    regenerated = SimpleNamespace(id=99)

    db = MagicMock()
    db.scalar.return_value = queue

    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_service, "generate_queue", lambda db_arg: regenerated)

    result = smart_review_service.get_or_create_active_queue(db)

    assert result is regenerated


def test_generate_queue_creates_queue_and_items(monkeypatch) -> None:
    db = FakeDB()
    word1 = SimpleNamespace(id=1)
    word2 = SimpleNamespace(id=2)

    deactivate = MagicMock()
    monkeypatch.setattr(smart_review_service, "_cooldown_word_ids", lambda db_arg: {999})
    monkeypatch.setattr(smart_review_service, "deactivate_all_queues", deactivate)
    monkeypatch.setattr(smart_review_service.random, "shuffle", lambda items: None)

    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_1_count", 1)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_2_count", 1)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_3_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_4_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_5_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_queue_ttl_hours", 24)

    def fake_pick(db_arg, level, needed, excluded_ids, topic_counts):
        if level == 1:
            return [word1]
        if level == 2:
            return [word2]
        return []

    monkeypatch.setattr(smart_review_service, "_pick_for_level_retry_excluded", fake_pick)

    queue = smart_review_service.generate_queue(cast(Session, cast(object, db)))

    assert queue.id == 123
    assert queue.total_count == 2
    assert queue.completed_count == 0
    assert queue.is_active is True
    assert queue.expires_at > queue.generated_at

    deactivate.assert_called_once_with(db)
    assert db.committed is True
    assert db.refreshed == [queue]

    items = [obj for obj in db.added if isinstance(obj, smart_review_service.StudyQueueItem)]
    assert len(items) == 2
    assert [item.word_id for item in items] == [1, 2]
    assert [item.position for item in items] == [0, 1]


def test_generate_queue_writes_audit_log(monkeypatch, caplog) -> None:
    db = FakeDB()
    word1 = SimpleNamespace(id=1)

    monkeypatch.setattr(smart_review_service, "_cooldown_word_ids", lambda db_arg: {999, 1000})
    monkeypatch.setattr(smart_review_service, "deactivate_all_queues", lambda db_arg: None)
    monkeypatch.setattr(smart_review_service.random, "shuffle", lambda items: None)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_1_count", 1)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_2_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_3_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_4_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_level_5_count", 0)
    monkeypatch.setattr(smart_review_service.settings, "smart_review_queue_ttl_hours", 24)
    monkeypatch.setattr(
        smart_review_service,
        "_pick_for_level_retry_excluded",
        lambda db_arg, level, needed, excluded_ids, topic_counts: [word1] if level == 1 else [],
    )

    with caplog.at_level(logging.INFO, logger="audit"):
        queue = smart_review_service.generate_queue(cast(Session, cast(object, db)))

    matching = [
        r for r in caplog.records
        if r.name == "audit" and r.message == "smart_review.queue.generated"
    ]
    assert matching
    assert matching[0].queue_id == queue.id
    assert matching[0].total_count == 1
    assert matching[0].cooldown_excluded_count == 2


def test_cooldown_word_ids_uses_completed_items_only(monkeypatch) -> None:
    monkeypatch.setattr(smart_review_service.settings, "smart_review_cooldown_days", 7)

    db = _make_sqlite_session()
    now = datetime.now(timezone.utc)

    word_completed = smart_review_service.Word(term="done", translations="done")
    word_pending = smart_review_service.Word(term="pending", translations="pending")
    db.add_all([word_completed, word_pending])
    db.flush()

    queue_completed = smart_review_service.StudyQueue(
        generated_at=now - timedelta(hours=1),
        expires_at=now + timedelta(hours=1),
        is_active=True,
        total_count=1,
        completed_count=1,
    )
    queue_pending = smart_review_service.StudyQueue(
        generated_at=now - timedelta(hours=1),
        expires_at=now + timedelta(hours=1),
        is_active=True,
        total_count=1,
        completed_count=0,
    )
    db.add_all([queue_completed, queue_pending])
    db.flush()

    db.add_all(
        [
            smart_review_service.StudyQueueItem(
                queue_id=queue_completed.id,
                word_id=word_completed.id,
                position=0,
                is_completed=True,
                completed_at=now - timedelta(hours=1),
            ),
            smart_review_service.StudyQueueItem(
                queue_id=queue_pending.id,
                word_id=word_pending.id,
                position=0,
                is_completed=False,
                completed_at=None,
            ),
        ]
    )
    db.flush()

    result = smart_review_service._cooldown_word_ids(cast(Session, db))

    assert result == {word_completed.id}


def test_complete_queue_item_raises_when_linked_word_is_deleted() -> None:
    item = SimpleNamespace(queue_id=5, word_id=10, is_completed=False, completed_at=None)
    queue = SimpleNamespace(
        is_active=True,
        completed_count=0,
        expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
    )
    deleted_word = SimpleNamespace(id=10, deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc), is_active=True)

    db = MagicMock()

    def fake_get(model, object_id):
        if model is smart_review_service.StudyQueueItem:
            return item
        if model is smart_review_service.StudyQueue:
            return queue
        if model is smart_review_service.Word:
            return deleted_word
        return None

    db.get.side_effect = fake_get

    with pytest.raises(smart_review_service.QueueNotActiveError):
        smart_review_service.complete_queue_item(db, 10)


def test_get_or_create_active_queue_regenerates_when_existing_queue_contains_deleted_word(monkeypatch) -> None:
    queue = SimpleNamespace(
        is_active=True,
        completed_count=0,
        total_count=1,
        items=[SimpleNamespace(word=SimpleNamespace(deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc), is_active=True))],
    )
    regenerated = SimpleNamespace(id=99)

    db = MagicMock()
    db.scalar.return_value = queue

    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_service, "generate_queue", lambda db_arg: regenerated)

    result = smart_review_service.get_or_create_active_queue(db)

    assert result is regenerated


def test_get_or_create_active_queue_regenerates_when_item_count_drifted(monkeypatch) -> None:
    queue = SimpleNamespace(
        is_active=True,
        completed_count=0,
        total_count=2,
        items=[SimpleNamespace(word=SimpleNamespace(deleted_at=None, is_active=True))],
    )
    regenerated = SimpleNamespace(id=100)

    db = MagicMock()
    db.scalar.return_value = queue

    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_service, "generate_queue", lambda db_arg: regenerated)

    result = smart_review_service.get_or_create_active_queue(db)

    assert result is regenerated


def test_get_or_create_active_queue_regenerates_stale_empty_queue_when_candidates_exist(monkeypatch) -> None:
    empty_queue = SimpleNamespace(is_active=True, total_count=0, completed_count=0, items=[])
    regenerated = SimpleNamespace(id=101)

    db = MagicMock()
    db.scalar.return_value = empty_queue

    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_service, "_cooldown_word_ids", lambda db_arg: set())
    monkeypatch.setattr(smart_review_service, "_has_any_candidates", lambda db_arg, excluded: True)
    monkeypatch.setattr(smart_review_service, "generate_queue", lambda db_arg: regenerated)

    result = smart_review_service.get_or_create_active_queue(db)

    assert result is regenerated


def test_get_or_create_active_queue_keeps_empty_queue_when_no_candidates_exist(monkeypatch) -> None:
    empty_queue = SimpleNamespace(is_active=True, total_count=0, completed_count=0, items=[])

    db = MagicMock()
    db.scalar.return_value = empty_queue

    generate = MagicMock()
    monkeypatch.setattr(smart_review_service.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_service, "_cooldown_word_ids", lambda db_arg: set())
    monkeypatch.setattr(smart_review_service, "_has_any_candidates", lambda db_arg, excluded: False)
    monkeypatch.setattr(smart_review_service, "generate_queue", generate)

    result = smart_review_service.get_or_create_active_queue(db)

    assert result is empty_queue
    generate.assert_not_called()
