from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.words.ai_review import service as ai_review_service
from app.features.words.ai_review.schemas import AiReviewImportRequest, AiReviewImportWord


def _make_topic(topic_id=1, name="Animals"):
    return SimpleNamespace(id=topic_id, name=name, deleted_at=None)


def _make_word(word_id=10, term="cat", example_items=None, translation_items=None):
    topic = _make_topic()
    return SimpleNamespace(
        id=word_id,
        term=term,
        language="en",
        definition=None,
        pronunciation_ipa=None,
        pronunciation_audio_url=None,
        image_url=None,
        translation_items=translation_items or [],
        example_items=example_items or [],
        topics=[topic],
        countability=None,
        part_of_speech=None,
        part_of_speech_id=None,
        cefr_level=None,
        register=None,
        frequency_rank=None,
        verb_form=None,
        synonym_items=[],
        antonym_items=[],
        collocation_items=[],
        confusable_items=[],
        pattern=None,
        notes=None,
        knowledge_level=1,
        is_active=True,
        deleted_at=None,
    )


def _make_payload(words, dry_run=False):
    return AiReviewImportRequest(
        schema_version="lexora.ai-review.v1",
        topic_id=1,
        dry_run=dry_run,
        words=words,
    )


def _ai_review_word(word_id, term, notes="updated note"):
    return AiReviewImportWord(
        id=word_id,
        term=term,
        translation_entries=["кошка"],
        pattern=None,
        example_entries=["The cat sat on the mat."],
        countability=None,
        part_of_speech=None,
        notes=notes,
        knowledge_level=1,
    )


def _make_db(topic, words):
    db = MagicMock()
    def fake_scalar(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        if "from topics" in sql.lower():
            return topic
        return 1

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()
        m = MagicMock()
        if "from topics" in sql and "join word_topics" not in sql:
            m.all.return_value = [topic]
        else:
            m.all.return_value = words
        m._sql = sql
        return m

    db.scalar.side_effect = fake_scalar
    db.scalars.side_effect = fake_scalars
    return db


# ---------------------------------------------------------------------------
# Atomicity — update_word called with commit=False; single commit at the end
# ---------------------------------------------------------------------------

def test_ai_review_import_calls_update_word_with_commit_false(monkeypatch) -> None:
    topic = _make_topic()
    word = _make_word()
    db = _make_db(topic, [word])

    calls_commit_flag = []

    def capture(db_arg, word, payload, commit=True):
        calls_commit_flag.append(commit)
        return word

    monkeypatch.setattr(ai_review_service, "update_word", capture)

    payload = _make_payload([_ai_review_word(word.id, word.term)])
    ai_review_service.import_topic_ai_review(db, payload)

    assert calls_commit_flag == [False], "update_word must be called with commit=False"
    db.commit.assert_called_once()


def test_ai_review_import_uses_single_commit_for_multiple_updates(monkeypatch) -> None:
    topic = _make_topic()
    word_a = _make_word(word_id=10, term="cat")
    word_b = _make_word(word_id=11, term="dog")
    db = _make_db(topic, [word_a, word_b])

    update_calls = []

    def capture(db_arg, word, payload, commit=True):
        update_calls.append((word.id, commit))
        return word

    monkeypatch.setattr(ai_review_service, "update_word", capture)

    payload = _make_payload([
        _ai_review_word(word_a.id, word_a.term),
        _ai_review_word(word_b.id, word_b.term),
    ])
    ai_review_service.import_topic_ai_review(db, payload)

    assert all(commit is False for _, commit in update_calls)
    db.commit.assert_called_once()


def test_ai_review_import_rolls_back_all_when_second_update_fails(monkeypatch) -> None:
    topic = _make_topic()
    word_a = _make_word(word_id=10, term="cat")
    word_b = _make_word(word_id=11, term="dog")
    db = _make_db(topic, [word_a, word_b])

    call_count = [0]

    def boom_on_second(db_arg, word, payload, commit=True):
        call_count[0] += 1
        if call_count[0] == 2:
            raise RuntimeError("DB exploded on second word")
        return word

    monkeypatch.setattr(ai_review_service, "update_word", boom_on_second)

    payload = _make_payload([
        _ai_review_word(word_a.id, word_a.term),
        _ai_review_word(word_b.id, word_b.term),
    ])

    with pytest.raises(RuntimeError):
        ai_review_service.import_topic_ai_review(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_ai_review_import_dry_run_never_commits(monkeypatch) -> None:
    topic = _make_topic()
    word = _make_word()
    db = _make_db(topic, [word])

    monkeypatch.setattr(ai_review_service, "update_word", lambda db, w, payload, commit=True: w)

    payload = _make_payload([_ai_review_word(word.id, word.term)], dry_run=True)
    result = ai_review_service.import_topic_ai_review(db, payload)

    db.commit.assert_not_called()
    db.rollback.assert_called_once()
    assert result.dry_run is True


def test_ai_review_export_for_parent_topic_includes_child_topic_words(monkeypatch) -> None:
    parent = _make_topic(topic_id=1, name="Parent")
    child = _make_topic(topic_id=2, name="Child")
    word = _make_word(word_id=10, term="cat")
    word.topics = [child]

    captured_sql: list[str] = []

    def fake_scalar(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        captured_sql.append(sql)
        if "from topics" in sql.lower():
            return parent
        return 1

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        captured_sql.append(sql)
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db = MagicMock()
    db.scalar.side_effect = fake_scalar
    db.scalars.side_effect = fake_scalars
    monkeypatch.setattr(ai_review_service, "get_active_subtree_topic_ids", lambda db, topic_id: [1, 2])

    result = ai_review_service.build_topic_ai_review_export(db, topic_id=1, page=1, page_size=20)

    assert result.topic_id == 1
    assert [item.id for item in result.words] == [10]
    assert any("select distinct" in sql.lower() for sql in captured_sql)
    assert any("count(distinct" in sql.lower() for sql in captured_sql)
    assert any("word_topics.topic_id in (1, 2)" in sql.lower() for sql in captured_sql)


def test_ai_review_import_accepts_child_topic_word_when_topic_id_is_parent(monkeypatch) -> None:
    parent = _make_topic(topic_id=1, name="Parent")
    child = _make_topic(topic_id=2, name="Child")
    word = _make_word(word_id=10, term="cat")
    word.topics = [child]
    db = _make_db(parent, [word])

    captured_sql: list[str] = []

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        captured_sql.append(sql)
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars
    monkeypatch.setattr(ai_review_service, "get_active_subtree_topic_ids", lambda db, topic_id: [1, 2])

    payload = _make_payload([
        _ai_review_word(word.id, word.term),
    ])
    result = ai_review_service.import_topic_ai_review(db, payload)

    assert result.updated == 1
    assert any("select distinct" in sql.lower() for sql in captured_sql)
    assert any("word_topics.topic_id in (1, 2)" in sql.lower() for sql in captured_sql)
