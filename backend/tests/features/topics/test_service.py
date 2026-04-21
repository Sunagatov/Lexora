from unittest.mock import MagicMock

import pytest

from app.features.topics.model import Topic
from app.features.topics import service as topic_service
from app.features.topics.schemas import TopicCreate, TopicUpdate


def test_assert_slug_available_allows_missing_slug() -> None:
    db = MagicMock()
    db.scalar.return_value = None

    topic_service.assert_slug_available(db, "travel")


def test_assert_slug_available_allows_same_topic_id() -> None:
    db = MagicMock()
    db.scalar.return_value = MagicMock(spec=Topic, id=7, deleted_at=None)

    topic_service.assert_slug_available(db, "travel", exclude_topic_id=7)


def test_assert_slug_available_raises_for_active_conflict() -> None:
    db = MagicMock()
    db.scalar.return_value = MagicMock(spec=Topic, id=9, deleted_at=None)

    with pytest.raises(topic_service.TopicSlugConflictError) as exc_info:
        topic_service.assert_slug_available(db, "travel")

    assert exc_info.value.detail == "Topic slug 'travel' already exists"


def test_assert_slug_available_raises_for_deleted_conflict() -> None:
    db = MagicMock()
    db.scalar.return_value = MagicMock(spec=Topic, id=9, deleted_at=object())

    with pytest.raises(topic_service.TopicSlugConflictError) as exc_info:
        topic_service.assert_slug_available(db, "travel")

    assert (
        exc_info.value.detail
        == "Topic slug 'travel' is used by a deleted topic — restore or permanently delete it first"
    )


def test_assert_topics_exist_raises_missing_ids_in_original_order() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [1, 3]

    with pytest.raises(topic_service.MissingTopicsError) as exc_info:
        topic_service.assert_topics_exist(db, [3, 2, 1, 4])

    assert exc_info.value.ids == [2, 4]


def test_create_topic_slugifies_and_persists(monkeypatch) -> None:
    db = MagicMock()
    db.scalar.return_value = None
    payload = TopicCreate(name="Daily Routine", description="desc", parent_topic_id=7, is_active=False)

    monkeypatch.setattr(topic_service, "slugify", lambda value, max_len: "daily-routine")
    slug_check = MagicMock()
    monkeypatch.setattr(topic_service, "assert_slug_available", slug_check)
    parent_check = MagicMock()
    monkeypatch.setattr(topic_service, "assert_topic_parent_valid", parent_check)

    topic = topic_service.create_topic(db, payload)

    assert topic.name == "Daily Routine"
    assert topic.slug == "daily-routine"
    assert topic.description == "desc"
    assert topic.parent_topic_id == 7
    assert topic.is_active is False

    slug_check.assert_called_once_with(db, "daily-routine")
    parent_check.assert_called_once_with(db, 7)
    db.add.assert_called_once_with(topic)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(topic)


def test_create_topic_raises_when_generated_slug_is_empty(monkeypatch) -> None:
    db = MagicMock()
    payload = TopicCreate(name="!!!")

    monkeypatch.setattr(topic_service, "slugify", lambda value, max_len: "")

    with pytest.raises(topic_service.InvalidTopicNameError) as exc_info:
        topic_service.create_topic(db, payload)

    assert exc_info.value.name == "!!!"


def test_create_topic_rejects_duplicate_active_name(monkeypatch) -> None:
    db = MagicMock()
    payload = TopicCreate(name="Travel")

    monkeypatch.setattr(topic_service, "slugify", lambda value, max_len: "travel")
    monkeypatch.setattr(topic_service, "assert_slug_available", MagicMock())
    db.scalar.return_value = MagicMock(spec=Topic, id=9, deleted_at=None)

    with pytest.raises(topic_service.TopicNameConflictError) as exc_info:
        topic_service.create_topic(db, payload)

    assert "Travel" in exc_info.value.detail


def test_update_topic_normalizes_new_slug_and_checks_availability(monkeypatch) -> None:
    db = MagicMock()
    topic = MagicMock(spec=Topic, id=5, slug="old-slug")
    payload = TopicUpdate(slug="New Slug")

    monkeypatch.setattr(topic_service, "slugify", lambda value, max_len: "new-slug")
    slug_check = MagicMock()
    monkeypatch.setattr(topic_service, "assert_slug_available", slug_check)

    expected = object()

    def fake_persist(db_arg, topic_arg, payload_arg):
        assert db_arg is db
        assert topic_arg is topic
        assert payload_arg.slug == "new-slug"
        return expected

    monkeypatch.setattr(topic_service, "persist_topic_update", fake_persist)

    result = topic_service.update_topic(db, topic, payload)

    assert result is expected
    slug_check.assert_called_once_with(db, "new-slug", exclude_topic_id=5)


def test_update_topic_skips_slug_check_when_slug_is_unchanged(monkeypatch) -> None:
    db = MagicMock()
    topic = MagicMock(spec=Topic, id=5, slug="same-slug")
    payload = TopicUpdate(slug="same-slug", description="Updated description")

    slug_check = MagicMock()
    monkeypatch.setattr(topic_service, "assert_slug_available", slug_check)

    expected = object()
    monkeypatch.setattr(topic_service, "persist_topic_update", lambda *_: expected)

    result = topic_service.update_topic(db, topic, payload)

    assert result is expected
    slug_check.assert_not_called()


def test_update_topic_renaming_without_explicit_slug_updates_slug(monkeypatch) -> None:
    db = MagicMock()
    db.scalar.return_value = None
    topic = MagicMock(spec=Topic, id=5, name="Old Name", slug="old-name")
    payload = TopicUpdate(name="New Name")

    monkeypatch.setattr(topic_service, "slugify", lambda value, max_len: "new-name")
    slug_check = MagicMock()
    monkeypatch.setattr(topic_service, "assert_slug_available", slug_check)

    expected = object()

    def fake_persist(db_arg, topic_arg, payload_arg):
        assert db_arg is db
        assert topic_arg is topic
        assert payload_arg.slug == "new-name"
        return expected

    monkeypatch.setattr(topic_service, "persist_topic_update", fake_persist)

    result = topic_service.update_topic(db, topic, payload)

    assert result is expected
    slug_check.assert_called_once_with(db, "new-name", exclude_topic_id=5)


def test_update_topic_raises_when_slug_produces_empty_string(monkeypatch) -> None:
    db = MagicMock()
    topic = MagicMock(spec=Topic, id=5, slug="old-slug")
    payload = TopicUpdate(slug="!!!")

    monkeypatch.setattr(topic_service, "slugify", lambda value, max_len: "")

    with pytest.raises(topic_service.InvalidTopicNameError) as exc_info:
        topic_service.update_topic(db, topic, payload)

    assert exc_info.value.name == "!!!"


def test_update_topic_rejects_duplicate_active_name(monkeypatch) -> None:
    db = MagicMock()
    topic = MagicMock(spec=Topic, id=5, name="Banking", slug="banking")
    payload = TopicUpdate(name="Travel")

    monkeypatch.setattr(topic_service, "assert_slug_available", MagicMock())
    db.scalar.return_value = MagicMock(spec=Topic, id=9, deleted_at=None)

    with pytest.raises(topic_service.TopicNameConflictError) as exc_info:
        topic_service.update_topic(db, topic, payload)

    assert "Travel" in exc_info.value.detail


def test_assert_topic_parent_valid_rejects_self_parent() -> None:
    db = MagicMock()
    db.scalar.return_value = MagicMock(spec=Topic, id=5, parent_topic_id=None, deleted_at=None)

    with pytest.raises(topic_service.InvalidTopicParentError) as exc_info:
        topic_service.assert_topic_parent_valid(db, 5, exclude_topic_id=5)

    assert "own parent" in exc_info.value.detail


def test_assert_topic_has_no_active_children_raises_with_child_names() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = ["Subtopic A", "Subtopic B"]

    with pytest.raises(topic_service.TopicHasActiveChildrenError) as exc_info:
        topic_service.assert_topic_has_no_active_children(db, 5)

    assert "Subtopic A" in exc_info.value.detail
    assert "Subtopic B" in exc_info.value.detail


def test_assert_topic_has_no_active_children_passes_when_no_children() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = []

    topic_service.assert_topic_has_no_active_children(db, 5)
