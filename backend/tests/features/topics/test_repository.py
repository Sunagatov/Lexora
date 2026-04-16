from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.topics import repository as topic_repository
from app.features.topics.schemas import TopicUpdate


def test_update_topic_applies_only_provided_fields_and_persists() -> None:
    db = MagicMock()
    topic = SimpleNamespace(
        name="Old",
        slug="old",
        description="old-desc",
        is_active=True,
    )
    payload = TopicUpdate(name="New", is_active=False)

    result = topic_repository.update_topic(db, topic, payload)

    assert result is topic
    assert topic.name == "New"
    assert topic.slug == "old"
    assert topic.description == "old-desc"
    assert topic.is_active is False
    db.add.assert_called_once_with(topic)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(topic)


def test_soft_delete_topic_uses_exclusive_word_strategy_by_default(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topic = make_topic()

    exclusive = MagicMock()
    all_words = MagicMock()
    monkeypatch.setattr(topic_repository, "soft_delete_exclusive_words", exclusive)
    monkeypatch.setattr(topic_repository, "soft_delete_all_words", all_words)

    result = topic_repository.soft_delete_topic(db, topic, delete_words=False)

    assert result is topic
    assert topic.deleted_at is not None
    exclusive.assert_called_once()
    all_words.assert_not_called()
    db.add.assert_called_once_with(topic)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(topic)


def test_soft_delete_topic_can_delete_all_words(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topic = make_topic()

    exclusive = MagicMock()
    all_words = MagicMock()
    monkeypatch.setattr(topic_repository, "soft_delete_exclusive_words", exclusive)
    monkeypatch.setattr(topic_repository, "soft_delete_all_words", all_words)

    topic_repository.soft_delete_topic(db, topic, delete_words=True)

    exclusive.assert_not_called()
    all_words.assert_called_once()


def test_restore_topic_restores_only_words_deleted_with_that_topic(
    make_topic,
    make_word,
    fixed_now,
) -> None:
    db = MagicMock()
    topic = make_topic(id=1, deleted_at=fixed_now)

    restore_me = make_word(id=1, deleted_at=fixed_now + timedelta(seconds=2))
    restore_me.topics = [topic]

    keep_time_mismatch = make_word(id=2, deleted_at=fixed_now + timedelta(seconds=10))
    keep_time_mismatch.topics = [topic]

    keep_shared = make_word(id=3, deleted_at=fixed_now + timedelta(seconds=2))
    keep_shared.topics = [topic, make_topic(id=99, slug="shared")]

    topic.words = [restore_me, keep_time_mismatch, keep_shared]

    result = topic_repository.restore_topic(db, topic, restore_words=True)

    assert result is topic
    assert topic.deleted_at is None
    assert restore_me.deleted_at is None
    assert keep_time_mismatch.deleted_at is not None
    assert keep_shared.deleted_at is not None
    db.add.assert_called_once_with(topic)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(topic)


def test_hard_delete_topic_soft_deletes_exclusive_words_then_deletes_topic(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topic = make_topic()

    exclusive = MagicMock()
    monkeypatch.setattr(topic_repository, "soft_delete_exclusive_words", exclusive)

    topic_repository.hard_delete_topic(db, topic)

    exclusive.assert_called_once_with(topic)
    db.delete.assert_called_once_with(topic)
    db.commit.assert_called_once()