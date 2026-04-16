from unittest.mock import MagicMock

import pytest

from app.features.words.domain import assert_no_duplicate_word, existing_normalized_terms
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