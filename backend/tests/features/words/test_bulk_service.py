from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.topics.service import InvalidTopicNameError, TopicSlugConflictError
from app.features.words import bulk_service
from app.features.words.schemas import WordBulkCreate, WordInput


class DummyWord:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def test_bulk_import_reuses_existing_topic_and_skips_duplicates(monkeypatch) -> None:
    topic = SimpleNamespace(id=7, name="Travel", deleted_at=None)
    db = MagicMock()
    db.scalar.side_effect = [topic]

    monkeypatch.setattr(bulk_service, "Word", DummyWord)
    monkeypatch.setattr(bulk_service, "existing_normalized_terms", lambda db, topic_ids: {"go"})

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[
            WordInput(term="go", translations="идти"),
            WordInput(term="Go", translations="идти again"),
            WordInput(term="stay", translations="остаться"),
        ],
    )

    result = bulk_service.bulk_import(db, payload)

    assert result.topic_id == 7
    assert result.topic_name == "Travel"
    assert result.added == 1
    assert result.skipped == 2
    assert result.added_terms == ["stay"]
    assert result.skipped_terms == ["go", "Go"]

    assert db.add.call_count == 1
    db.commit.assert_called_once()


def test_bulk_import_raises_when_topic_exists_only_in_trash() -> None:
    deleted_topic = SimpleNamespace(id=9, name="Travel", deleted_at=object())
    db = MagicMock()
    db.scalar.side_effect = [None, deleted_topic]

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="stay", translations="остаться")],
    )

    with pytest.raises(bulk_service.BulkTopicInTrashError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.name == "Travel"


def test_bulk_import_maps_invalid_topic_name_from_create_topic(monkeypatch) -> None:
    db = MagicMock()
    db.scalar.side_effect = [None, None]

    def fake_create_topic(db_arg, topic_payload):
        raise InvalidTopicNameError(topic_payload.name)

    monkeypatch.setattr(bulk_service, "create_topic", fake_create_topic)

    payload = WordBulkCreate(
        topic_name="!!!",
        words=[WordInput(term="stay", translations="остаться")],
    )

    with pytest.raises(bulk_service.BulkInvalidTopicNameError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.name == "!!!"


def test_bulk_import_maps_slug_conflict_from_create_topic(monkeypatch) -> None:
    db = MagicMock()
    db.scalar.side_effect = [None, None]

    def fake_create_topic(db_arg, topic_payload):
        raise TopicSlugConflictError("Topic slug 'travel' already exists")

    monkeypatch.setattr(bulk_service, "create_topic", fake_create_topic)

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="stay", translations="остаться")],
    )

    with pytest.raises(bulk_service.BulkSlugConflictError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.detail == "Topic slug 'travel' already exists"