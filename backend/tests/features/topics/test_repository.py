from unittest.mock import MagicMock

from app.features.topics import repository as topic_repository
from app.features.topics.schemas import TopicUpdate


class TopicStub:
    def __init__(self, *, id: int = 1, name: str, slug: str, description: str, is_active: bool) -> None:
        self.id = id
        self.name = name
        self.slug = slug
        self.description = description
        self.is_active = is_active
        self.deleted_at = None


def test_update_topic_applies_only_provided_fields_and_persists() -> None:
    db = MagicMock()
    topic = TopicStub(
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


def test_soft_delete_topic_soft_deletes_word_when_only_other_topics_are_deleted(make_topic, make_word) -> None:
    db = MagicMock()
    active_topic = TopicStub(id=1, name="Active", slug="active", description="", is_active=True)
    active_topic.deleted_at = None
    active_topic.words = []
    deleted_topic = TopicStub(id=2, name="Deleted", slug="deleted", description="", is_active=True)
    deleted_topic.deleted_at = object()
    deleted_topic.words = []
    word = make_word(id=5, deleted_at=None, deleted_via_topic_id=None, topics=[active_topic, deleted_topic])
    active_topic.words = [word]

    topic_repository.soft_delete_topic(db, active_topic, delete_words=False)

    assert word.deleted_at is not None
    assert word.deleted_via_topic_id == 1


def test_restore_topic_restores_words_deleted_with_that_topic_including_shared(
    make_topic,
    make_word,
) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    topic = make_topic(id=1, deleted_at=object())

    restore_me = make_word(id=1, deleted_at=object(), deleted_via_topic_id=1)
    restore_me.topics = [topic]

    keep_other_provenance = make_word(id=2, deleted_at=object(), deleted_via_topic_id=99)
    keep_other_provenance.topics = [topic]

    # Shared word deleted by this topic-delete operation — should be restored too.
    also_restore_shared = make_word(id=3, deleted_at=object(), deleted_via_topic_id=1)
    also_restore_shared.topics = [topic, make_topic(id=99, slug="shared")]

    topic.words = [restore_me, keep_other_provenance, also_restore_shared]

    result = topic_repository.restore_topic(db, topic, restore_words=True)

    assert result is topic
    assert topic.deleted_at is None
    assert restore_me.deleted_at is None
    assert restore_me.deleted_via_topic_id is None
    assert keep_other_provenance.deleted_at is not None
    assert keep_other_provenance.deleted_via_topic_id == 99
    assert also_restore_shared.deleted_at is None
    assert also_restore_shared.deleted_via_topic_id is None
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
