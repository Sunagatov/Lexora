from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.words.ai_review import service as ai_review_service
from app.features.words.ai_review.schemas import AiReviewImportRequest, AiReviewImportWord


def _make_topic(id=1, name="Animals"):
    return SimpleNamespace(id=id, name=name, deleted_at=None)


def _make_word(id=10, term="cat", example_items=None, translation_items=None):
    topic = _make_topic()
    return SimpleNamespace(
        id=id,
        term=term,
        translations="кошка",
        translation_items=translation_items or [],
        example_items=example_items or [],
        topics=[topic],
        countability=None,
        part_of_speech=None,
        past_simple=None,
        past_participle=None,
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


def _ai_review_word(id, term, notes="updated note"):
    return AiReviewImportWord(
        id=id,
        term=term,
        translations="кошка",
        translation_entries=["кошка"],
        pattern=None,
        example_entries=["The cat sat on the mat."],
        countability=None,
        part_of_speech=None,
        past_simple=None,
        past_participle=None,
        notes=notes,
        knowledge_level=1,
    )


def _make_db(topic, words):
    db = MagicMock()
    db.scalar.return_value = topic

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = words
        return m

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

    def capture(db, w, payload, commit=True):
        calls_commit_flag.append(commit)
        return w

    monkeypatch.setattr(ai_review_service, "update_word", capture)

    payload = _make_payload([_ai_review_word(word.id, word.term)])
    ai_review_service.import_topic_ai_review(db, payload)

    assert calls_commit_flag == [False], "update_word must be called with commit=False"
    db.commit.assert_called_once()


def test_ai_review_import_uses_single_commit_for_multiple_updates(monkeypatch) -> None:
    topic = _make_topic()
    word_a = _make_word(id=10, term="cat")
    word_b = _make_word(id=11, term="dog")
    db = _make_db(topic, [word_a, word_b])

    update_calls = []

    def capture(db, w, payload, commit=True):
        update_calls.append((w.id, commit))
        return w

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
    word_a = _make_word(id=10, term="cat")
    word_b = _make_word(id=11, term="dog")
    db = _make_db(topic, [word_a, word_b])

    call_count = [0]

    def boom_on_second(db, w, payload, commit=True):
        call_count[0] += 1
        if call_count[0] == 2:
            raise RuntimeError("DB exploded on second word")
        return w

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
