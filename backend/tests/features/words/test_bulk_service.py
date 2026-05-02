from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.topics.service import InvalidTopicNameError, TopicNameConflictError, TopicSlugConflictError
from app.features.words.bulk import service as bulk_service
from app.features.words.schemas import WordBulkCreate, WordInput


class DummyWord:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def test_bulk_import_reuses_existing_topic_and_skips_duplicates(monkeypatch) -> None:
    topic = SimpleNamespace(id=7, name="Travel", deleted_at=None)
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: topic)

    monkeypatch.setattr(bulk_service, "Word", DummyWord)
    monkeypatch.setattr(bulk_service, "existing_normalized_terms", lambda db_arg, topic_ids: {"go"})

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[
            WordInput(term="go", translation_entries=["идти"]),
            WordInput(term="Go", translation_entries=["идти again"]),
            WordInput(term="stay", translation_entries=["остаться"]),
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


def test_bulk_import_raises_when_topic_exists_only_in_trash(monkeypatch) -> None:
    deleted_topic = SimpleNamespace(id=9, name="Travel", deleted_at=object())
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: deleted_topic)

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="stay", translation_entries=["остаться"])],
    )

    with pytest.raises(bulk_service.BulkTopicInTrashError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.name == "Travel"


def test_bulk_import_maps_invalid_topic_name_from_create_topic(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_slug", lambda db_arg, slug: None)

    def fake_create_topic_draft(db_arg, *, name, description=None, parent_topic_id=None, is_active=True):
        raise InvalidTopicNameError(name)

    monkeypatch.setattr(bulk_service, "create_topic_draft", fake_create_topic_draft)

    payload = WordBulkCreate(
        topic_name="!!!",
        words=[WordInput(term="stay", translation_entries=["остаться"])],
    )

    with pytest.raises(bulk_service.BulkInvalidTopicNameError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.name == "!!!"


def test_bulk_import_maps_slug_conflict_from_create_topic(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_slug", lambda db_arg, slug: None)

    def fake_create_topic_draft(db_arg, *, name, description=None, parent_topic_id=None, is_active=True):
        raise TopicSlugConflictError("Topic slug 'travel' already exists")

    monkeypatch.setattr(bulk_service, "create_topic_draft", fake_create_topic_draft)

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="stay", translation_entries=["остаться"])],
    )

    with pytest.raises(bulk_service.BulkSlugConflictError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.detail == "Topic slug 'travel' already exists"


def test_bulk_import_reuses_existing_topic_when_name_slugifies_to_same_slug(monkeypatch) -> None:
    topic = SimpleNamespace(id=3, name="Daily Life", slug="daily-life", deleted_at=None)
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: topic)

    monkeypatch.setattr(bulk_service, "Word", DummyWord)
    monkeypatch.setattr(bulk_service, "existing_normalized_terms", lambda db_arg, topic_ids: set())

    payload = WordBulkCreate(
        topic_name="daily-life",
        words=[WordInput(term="routine", translation_entries=["рутина"])],
    )

    result = bulk_service.bulk_import(db, payload)

    assert result.topic_id == 3
    assert result.topic_name == "Daily Life"
    assert result.added == 1
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_bulk_import_raises_when_slug_equivalent_topic_is_in_trash(monkeypatch) -> None:
    deleted_topic = SimpleNamespace(id=4, name="Daily Life", slug="daily-life", deleted_at=object())
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_slug", lambda db_arg, slug: deleted_topic)

    payload = WordBulkCreate(
        topic_name="daily-life",
        words=[WordInput(term="routine", translation_entries=["рутина"])],
    )

    with pytest.raises(bulk_service.BulkTopicInTrashError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.name == "Daily Life"


def test_bulk_import_creates_topic_without_committing_early(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_slug", lambda db_arg, slug: None)

    created_topic = SimpleNamespace(id=11, name="Travel", slug="travel", deleted_at=None)
    monkeypatch.setattr(bulk_service, "Word", DummyWord)

    def fake_create_topic_draft(db_arg, *, name, description=None, parent_topic_id=None, is_active=True):
        return created_topic

    monkeypatch.setattr(bulk_service, "create_topic_draft", fake_create_topic_draft)
    monkeypatch.setattr(bulk_service, "existing_normalized_terms", lambda db_arg, topic_ids: set())
    monkeypatch.setattr(
        bulk_service,
        "sync_word_multivalue_fields",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="stay", translation_entries=["остаться"])],
    )

    with pytest.raises(RuntimeError):
        bulk_service.bulk_import(db, payload)

    db.commit.assert_not_called()
    db.rollback.assert_called_once()


def test_bulk_import_reuses_existing_topic_when_exact_name_matches_but_slug_differs(monkeypatch) -> None:
    topic = SimpleNamespace(id=8, name="Travel", slug="travel-2026", deleted_at=None)
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: topic)
    monkeypatch.setattr(bulk_service, "Word", DummyWord)
    monkeypatch.setattr(bulk_service, "existing_normalized_terms", lambda db_arg, topic_ids: set())

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="ticket", translation_entries=["билет"])],
    )

    result = bulk_service.bulk_import(db, payload)

    assert result.topic_id == 8
    assert result.topic_name == "Travel"
    assert result.added == 1
    db.commit.assert_called_once()


def test_bulk_import_raises_when_exact_name_match_is_only_in_trash(monkeypatch) -> None:
    deleted_topic = SimpleNamespace(id=9, name="Travel", slug="travel-archived", deleted_at=object())
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: deleted_topic)

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="ticket", translation_entries=["билет"])],
    )

    with pytest.raises(bulk_service.BulkTopicInTrashError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert exc_info.value.name == "Travel"


def test_bulk_import_maps_name_conflict_from_create_topic(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(bulk_service, "find_active_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_active_topic_by_slug", lambda db_arg, slug: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_exact_name", lambda db_arg, topic_name: None)
    monkeypatch.setattr(bulk_service, "find_deleted_topic_by_slug", lambda db_arg, slug: None)

    def fake_create_topic_draft(db_arg, *, name, description=None, parent_topic_id=None, is_active=True):
        raise TopicNameConflictError(f"Active topic name '{name}' already exists")

    monkeypatch.setattr(bulk_service, "create_topic_draft", fake_create_topic_draft)

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="ticket", translation_entries=["билет"])],
    )

    with pytest.raises(bulk_service.BulkSlugConflictError) as exc_info:
        bulk_service.bulk_import(db, payload)

    assert "Travel" in exc_info.value.detail
