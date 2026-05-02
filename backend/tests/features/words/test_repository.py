from __future__ import annotations

from unittest.mock import MagicMock

from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words import repository as word_repository
from app.features.words.constants import PROGRESS_SOURCE_SMART_REVIEW
from app.features.words.schemas import WordCreate, WordUpdate


class DummyWord:
    term: str
    translations: str
    knowledge_level: int | None
    topics: list[TopicStub]

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class TopicStub:
    def __init__(self, id: int):
        self.id = id


def _make_topic_mock(id: int):
    topic = MagicMock(spec=Topic)
    topic.id = id
    return topic


class ExampleStub:
    value: str

    def __init__(self, value: str):
        self.value = value


def _make_word_mock(
    *,
    id: int,
    term: str,
    translations: str = "",
    part_of_speech=None,
    knowledge_level,
    countability,
    pattern,
    example=None,
    notes,
    is_active: bool,
    topics,
    example_items=None,
):
    word = MagicMock(spec=Word)
    word.id = id
    word.term = term
    word.language = "en"
    word.definition = None
    word.pronunciation_ipa = None
    word.pronunciation_audio_url = None
    word.image_url = None
    word.part_of_speech = part_of_speech
    word.part_of_speech_id = None
    word.cefr_level = None
    word.register = None
    word.frequency_rank = None
    word.knowledge_level = knowledge_level
    word.countability = countability
    word.pattern = pattern
    word.example_items = list(example_items or [])
    word.translation_items = []
    word.synonym_items = []
    word.antonym_items = []
    word.collocation_items = []
    word.confusable_items = []
    word.verb_form = None
    word.notes = notes
    word.is_active = is_active
    word.topics = list(topics)
    return word


def test_create_word_persists_new_word_with_topics(monkeypatch) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [TopicStub(1), TopicStub(2)]

    duplicate_check = MagicMock()
    monkeypatch.setattr(word_repository, "Word", DummyWord)
    monkeypatch.setattr(word_repository, "existing_normalized_terms", lambda db_arg, topic_ids: set())
    monkeypatch.setattr(word_repository, "assert_no_duplicate_word", duplicate_check)

    payload = WordCreate(
        topic_ids=[1, 2],
        term="run",
        translation_entries=["бежать"],
        knowledge_level=2,
    )

    word = word_repository.create_word(db, payload)

    assert isinstance(word, DummyWord)
    assert word.term == "run"
    assert word.knowledge_level == 2
    assert [topic.id for topic in word.topics] == [1, 2]

    args = duplicate_check.call_args.args
    assert args[0] == "run"
    assert args[1] == set()

    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_get_all_words_for_parent_topic_includes_descendants(make_topic, make_word) -> None:
    db = MagicMock()
    parent = make_topic(id=1, parent_topic_id=None)
    child = make_topic(id=2, parent_topic_id=1)
    grandchild = make_topic(id=3, parent_topic_id=2)
    db.scalars.side_effect = [
        MagicMock(all=MagicMock(return_value=[parent, child, grandchild])),
        MagicMock(all=MagicMock(return_value=[make_word(id=10, topics=[child]), make_word(id=11, topics=[grandchild])])),
    ]

    result = word_repository.get_all_words(db, topic_id=1)

    assert [word.id for word in result] == [10, 11]
    assert db.scalars.call_count == 2


def test_get_all_words_for_parent_topic_deduplicates_same_word_seen_via_multiple_topics(make_topic, make_word) -> None:
    db = MagicMock()
    parent = make_topic(id=1, parent_topic_id=None)
    child = make_topic(id=2, parent_topic_id=1)
    shared_word = make_word(id=10, topics=[parent, child])

    seen_sql: list[str] = []
    call_count = [0]

    def fake_scalars(stmt):
        call_count[0] += 1
        if call_count[0] == 1:
            return MagicMock(all=MagicMock(return_value=[parent, child]))
        seen_sql.append(str(stmt.compile(compile_kwargs={"literal_binds": True})))
        return MagicMock(all=MagicMock(return_value=[shared_word]))

    db.scalars.side_effect = fake_scalars

    result = word_repository.get_all_words(db, topic_id=1)

    assert [word.id for word in result] == [10]
    assert any("select distinct" in sql.lower() for sql in seen_sql)


def test_update_word_replaces_topics_and_records_level_change(monkeypatch) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [_make_topic_mock(2), _make_topic_mock(3)]

    word = _make_word_mock(
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
        topics=[_make_topic_mock(1)],
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
        progress_source=PROGRESS_SOURCE_SMART_REVIEW,
    )

    result = word_repository.update_word(db, word, payload)

    assert result is word
    assert word.term == "walk faster"
    assert word.knowledge_level == 3
    assert [topic.id for topic in word.topics] == [2, 3]

    record_change.assert_called_once_with(db, 10, 1, 3, PROGRESS_SOURCE_SMART_REVIEW)
    db.add.assert_called_once_with(word)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(word)


def test_update_word_does_not_record_level_change_when_level_is_unchanged(monkeypatch) -> None:
    db = MagicMock()
    word = _make_word_mock(
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
        topics=[_make_topic_mock(1)],
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
    word = _make_word_mock(
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
        topics=[_make_topic_mock(1)],
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


def test_update_word_clears_examples_when_explicit_empty_list_is_provided(monkeypatch) -> None:
    db = MagicMock()
    word = _make_word_mock(
        id=13,
        term="read",
        translations="читать",
        part_of_speech=None,
        knowledge_level=3,
        countability=None,
        pattern=None,
        example=None,
        example_items=[ExampleStub("Old example line")],
        notes=None,
        is_active=True,
        topics=[_make_topic_mock(1)],
    )

    monkeypatch.setattr(word_repository, "record_level_change", MagicMock())
    monkeypatch.setattr(word_repository, "existing_normalized_terms", lambda *args, **kwargs: set())
    monkeypatch.setattr(word_repository, "assert_no_duplicate_word", MagicMock())

    payload = WordUpdate(example_entries=[])

    result = word_repository.update_word(db, word, payload)

    assert result is word
    assert word.example_items == []
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
