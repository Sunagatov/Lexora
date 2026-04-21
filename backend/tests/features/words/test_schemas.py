import pytest
from pydantic import ValidationError

from app.features.words.schemas import WordUpdate


def test_word_update_rejects_explicit_null_term() -> None:
    with pytest.raises(ValidationError):
        WordUpdate(term=None)


def test_word_update_rejects_explicit_null_translations() -> None:
    with pytest.raises(ValidationError):
        WordUpdate(translations=None)


def test_word_update_rejects_explicit_null_topic_ids() -> None:
    with pytest.raises(ValidationError):
        WordUpdate(topic_ids=None)


def test_word_update_rejects_explicit_null_is_active() -> None:
    with pytest.raises(ValidationError):
        WordUpdate(is_active=None)


def test_word_update_allows_knowledge_level_null() -> None:
    payload = WordUpdate(knowledge_level=None)

    assert payload.knowledge_level is None
