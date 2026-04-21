from unittest.mock import MagicMock

import pytest

from types import SimpleNamespace

from app.features.words.domain import (
    assert_no_duplicate_word,
    assert_word_restore_allowed,
    existing_normalized_terms,
)
from app.features.words.exceptions import DuplicateWordInTopicError


def test_existing_normalized_terms_returns_normalized_set() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        "  Hello ",
        "HELLO",
        "Ｆｏｏ   Bar",
    ]

    result = existing_normalized_terms(db, [1, 2])

    assert result == {"hello", "foo bar"}


def test_assert_no_duplicate_word_raises_for_normalized_duplicate() -> None:
    with pytest.raises(DuplicateWordInTopicError) as exc_info:
        assert_no_duplicate_word("  HELLO ", {"hello", "world"})

    assert str(exc_info.value) == "Word '  HELLO ' already exists in one of the selected topics"


def test_assert_no_duplicate_word_allows_unique_term() -> None:
    assert_no_duplicate_word("new term", {"hello", "world"})


def test_assert_word_restore_allowed_checks_active_topics_and_restoring_topic_ids(monkeypatch) -> None:
    db = MagicMock()
    topic = SimpleNamespace(id=1, deleted_at=None)
    deleted_topic = SimpleNamespace(id=2, deleted_at=object())
    word = SimpleNamespace(id=10, term="plane", topics=[topic, deleted_topic])

    seen_topic_ids = []

    def fake_existing_normalized_terms(db_arg, topic_ids, exclude_word_id=None):
        seen_topic_ids.append((tuple(topic_ids), exclude_word_id))
        return {"plane"}

    monkeypatch.setattr("app.features.words.domain.existing_normalized_terms", fake_existing_normalized_terms)

    with pytest.raises(DuplicateWordInTopicError):
        assert_word_restore_allowed(db, word, restoring_topic_ids={3})

    assert seen_topic_ids == [((1, 3), 10)]
