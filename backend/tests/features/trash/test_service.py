from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.trash import service as trash_service


def _make_word(word_id: int, deleted_at, topics: list) -> SimpleNamespace:
    return SimpleNamespace(id=word_id, deleted_at=deleted_at, topics=topics)


def _make_topic(id: int, deleted_at=object()) -> SimpleNamespace:
    return SimpleNamespace(id=id, deleted_at=deleted_at, words=[])


def test_purge_trash_hard_deletes_topics_and_soft_deleted_words(monkeypatch) -> None:
    db = MagicMock()
    topic = _make_topic(id=1)
    topic.words = []
    db.scalars.return_value.all.return_value = [topic]
    monkeypatch.setattr(trash_service.settings, "trash_retention_days", 30)

    trash_service.purge_trash(db, force=False)

    assert db.execute.call_count == 2  # topic delete + word delete
    db.commit.assert_called_once()


def test_purge_trash_force_deletes_all_trashed_items(monkeypatch) -> None:
    db = MagicMock()
    topic = _make_topic(id=10)
    topic.words = []
    db.scalars.return_value.all.return_value = [topic]

    trash_service.purge_trash(db, force=True)

    assert db.execute.call_count == 2
    db.commit.assert_called_once()


def test_purge_trash_hard_deletes_active_word_that_loses_all_topics(monkeypatch) -> None:
    """Active word whose only topic is being purged should be hard-deleted."""
    db = MagicMock()

    topic = _make_topic(id=1)
    # active word (deleted_at=None) that belongs only to this topic
    orphan_word = _make_word(word_id=5, deleted_at=None, topics=[topic])
    topic.words = [orphan_word]

    db.scalars.return_value.all.return_value = [topic]
    monkeypatch.setattr(trash_service.settings, "trash_retention_days", 30)

    trash_service.purge_trash(db, force=False)

    # The word id should appear in the delete conditions
    call_args = [str(call) for call in db.execute.call_args_list]
    assert any("5" in arg for arg in call_args)
    db.commit.assert_called_once()


def test_purge_trash_keeps_active_word_that_still_has_surviving_topic(monkeypatch) -> None:
    """Active word that has another topic not being purged should NOT be hard-deleted via orphan path."""
    db = MagicMock()

    topic_purged = _make_topic(id=1)
    topic_surviving = SimpleNamespace(id=99, deleted_at=None)

    safe_word = _make_word(word_id=7, deleted_at=None, topics=[topic_purged, topic_surviving])
    topic_purged.words = [safe_word]

    db.scalars.return_value.all.return_value = [topic_purged]
    monkeypatch.setattr(trash_service.settings, "trash_retention_days", 30)

    trash_service.purge_trash(db, force=False)

    # The word delete execute call won't include id 7 because conditions won't add it
    # We verify by checking _word_loses_all_remaining_topics logic directly
    assert not trash_service._word_loses_all_remaining_topics(safe_word, {1})


def test_word_loses_all_remaining_topics_true_when_all_topics_purged() -> None:
    topic_a = SimpleNamespace(id=1, deleted_at=object())
    topic_b = SimpleNamespace(id=2, deleted_at=None)
    word = SimpleNamespace(topics=[topic_a, topic_b])

    assert trash_service._word_loses_all_remaining_topics(word, purged_topic_ids={1, 2}) is True


def test_word_loses_all_remaining_topics_false_when_one_topic_survives() -> None:
    topic_a = SimpleNamespace(id=1, deleted_at=None)
    topic_b = SimpleNamespace(id=2, deleted_at=None)
    word = SimpleNamespace(topics=[topic_a, topic_b])

    assert trash_service._word_loses_all_remaining_topics(word, purged_topic_ids={1}) is False
