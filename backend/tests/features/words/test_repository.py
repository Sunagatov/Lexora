from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.words import repository as word_repository
from app.features.words.schemas import WordCreate, WordUpdate


class DummyWord:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def test_create_word_persists_new_word_with_topics(monkeypatch) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(id=1),
        SimpleNamespace(id=2),
    ]

    duplicate_check = MagicMock()
    monkeypatch.setattr(word_repository, "Word", DummyWord)
    monkeypatch.setattr(word_repository, "existing_normalized_terms", lambda db_arg, topic_ids: set())
    monkeypatch.setattr(word_repository, "assert_no_duplicate_word", duplicate_check)

    payload = WordCreate(
        topic_ids=[1, 2],
        term="run",
        translations="бежать",
        knowledge_level=2,
    )

    word = word_repository.create_word(db, payload)

    assert isinstance(word, DummyWord)
    assert word.term == "run"
    assert word.translations == "бежать"
    assert word.knowledge_level == 2
    assert [topic.id for topic in word.topics] == [1, 2]

    args = duplicate_check.call_args.args
    assert args[0] == "run"
    assert args[1] == set()

    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_update_word_replaces_topics_and_records_level_change(monkeypatch) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [SimpleNamespace(id=2), SimpleNamespace(id=3)]

    word = SimpleNamespace(
        id=10,
        term="walk",
        translations="идти",
        part_of_speech=None,
        knowledge_level=1,
        countability=None,
        pattern=None,
        example=None,
        notes=None,
        is_active=True,
        topics=[SimpleNamespace(id=1)],
    )

    duplicate_check = MagicMock()
    record_change = MagicMock()
    monkeypatch.setattr(word_repository, "existing_normalized_terms", lambda *args, **kwargs: set())
    monkeypatch.setattr(word_repository, "assert_no_duplicate_word", duplicate_check)
    monkeypatch.setattr(word_repository, "record_level_change", record_change)

    payload = WordUpdate(
        term="walk faster",
        knowledge_level=3,
        topic_ids=[2, 3],
        progress_source="smart_review",
    )

    result = word_repository.update_word(db, word, payload)

    assert result is word
    assert word.term == "walk faster"
    assert word.knowledge_level == 3
    assert [topic.id for topic in word.topics] == [2, 3]

    record_change.assert_called_once_with(db, 10, 1, 3, "smart_review")
    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_update_word_does_not_record_level_change_when_level_is_unchanged(monkeypatch) -> None:
    db = MagicMock()
    word = SimpleNamespace(
        id=11,
        term="read",
        translations="читать",
        part_of_speech=None,
        knowledge_level=3,
        countability=None,
        pattern=None,
        example=None,
        notes=None,
        is_active=True,
        topics=[SimpleNamespace(id=1)],
    )

    record_change = MagicMock()
    monkeypatch.setattr(word_repository, "record_level_change", record_change)
    monkeypatch.setattr(word_repository, "existing_normalized_terms", lambda *args, **kwargs: set())
    monkeypatch.setattr(word_repository, "assert_no_duplicate_word", MagicMock())

    payload = WordUpdate(notes="Updated note")

    result = word_repository.update_word(db, word, payload)

    assert result is word
    assert word.notes == "Updated note"
    record_change.assert_not_called()
    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_update_word_allows_clearing_knowledge_level_without_progress_event(monkeypatch) -> None:
    db = MagicMock()
    word = SimpleNamespace(
        id=12,
        term="read",
        translations="читать",
        part_of_speech=None,
        knowledge_level=3,
        countability=None,
        pattern=None,
        example=None,
        notes=None,
        is_active=True,
        topics=[SimpleNamespace(id=1)],
    )

    record_change = MagicMock()
    monkeypatch.setattr(word_repository, "record_level_change", record_change)
    monkeypatch.setattr(word_repository, "existing_normalized_terms", lambda *args, **kwargs: set())
    monkeypatch.setattr(word_repository, "assert_no_duplicate_word", MagicMock())

    payload = WordUpdate(knowledge_level=None)

    result = word_repository.update_word(db, word, payload)

    assert result is word
    assert word.knowledge_level is None
    record_change.assert_not_called()
    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_soft_delete_word_marks_deleted_and_persists(make_word) -> None:
    db = MagicMock()
    word = make_word(deleted_at=None, deleted_via_topic_id=7)

    result = word_repository.soft_delete_word(db, word)

    assert result is word
    assert word.deleted_at is not None
    assert word.deleted_via_topic_id is None
    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_restore_word_clears_deleted_provenance(make_word) -> None:
    db = MagicMock()
    word = make_word(deleted_at=object(), deleted_via_topic_id=7)

    result = word_repository.restore_word(db, word)

    assert result is word
    assert word.deleted_at is None
    assert word.deleted_via_topic_id is None
    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)
