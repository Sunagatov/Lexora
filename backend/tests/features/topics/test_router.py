from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.features.topics import router as topic_router
from app.features.topics.schemas import TopicCreate, TopicUpdate
from app.features.topics.service import InvalidTopicNameError, TopicSlugConflictError


def test_get_topic_raises_404_when_missing(monkeypatch) -> None:
    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: None)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.get_topic(1, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Topic not found"


def test_create_topic_route_maps_invalid_name_to_400(monkeypatch) -> None:
    def fake_create_topic(db, payload):
        raise InvalidTopicNameError(payload.name)

    monkeypatch.setattr(topic_router, "create_topic", fake_create_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.create_topic_route(TopicCreate(name="!!!"), db=object())

    assert exc_info.value.status_code == 400
    assert "Cannot generate a valid slug" in exc_info.value.detail


def test_create_topic_route_maps_slug_conflict_to_409(monkeypatch) -> None:
    def fake_create_topic(db, payload):
        raise TopicSlugConflictError("Topic slug 'travel' already exists")

    monkeypatch.setattr(topic_router, "create_topic", fake_create_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.create_topic_route(TopicCreate(name="Travel"), db=object())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Topic slug 'travel' already exists"


def test_update_topic_route_raises_404_when_topic_is_missing(monkeypatch) -> None:
    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: None)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.update_topic_route(1, TopicUpdate(name="New"), db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Topic not found"


def test_delete_topic_calls_soft_delete_with_flag(monkeypatch, make_topic) -> None:
    topic = make_topic(id=10)
    called = MagicMock()

    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: topic)
    monkeypatch.setattr(topic_router, "soft_delete_topic", called)

    topic_router.delete_topic(10, delete_words=True, db=object())

    called.assert_called_once_with(object(), topic, delete_words=True)