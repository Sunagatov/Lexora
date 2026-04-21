import pytest
from pydantic import ValidationError

from app.features.topics.schemas import TopicUpdate


def test_topic_update_rejects_explicit_null_name() -> None:
    with pytest.raises(ValidationError):
        TopicUpdate(name=None)


def test_topic_update_rejects_explicit_null_slug() -> None:
    with pytest.raises(ValidationError):
        TopicUpdate(slug=None)


def test_topic_update_rejects_explicit_null_is_active() -> None:
    with pytest.raises(ValidationError):
        TopicUpdate(is_active=None)


def test_topic_update_allows_description_null() -> None:
    payload = TopicUpdate(description=None)

    assert payload.description is None
