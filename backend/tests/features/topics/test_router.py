from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.features.topics import router as topic_router
from app.features.topics.schemas import TopicCreate, TopicUpdate
from app.features.topics.service import (
    InvalidTopicNameError,
    InvalidTopicParentError,
    TopicHasActiveChildrenError,
    TopicNameConflictError,
    TopicSlugConflictError,
)
from app.features.topics.refinement_schemas import TopicAuditResponse, TopicSplitPlanRequest


def test_get_topic_raises_404_when_missing(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: None)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.get_topic(1, db=db)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Topic not found"


def test_create_topic_route_maps_invalid_name_to_400(monkeypatch) -> None:
    db = MagicMock()

    def fake_create_topic(db, payload):
        raise InvalidTopicNameError(payload.name)

    monkeypatch.setattr(topic_router, "create_topic", fake_create_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.create_topic_route(TopicCreate(name="!!!"), db=db)

    assert exc_info.value.status_code == 400
    assert "Cannot generate a valid slug" in exc_info.value.detail


def test_create_topic_route_maps_slug_conflict_to_409(monkeypatch) -> None:
    db = MagicMock()

    def fake_create_topic(db, payload):
        raise TopicSlugConflictError("Topic slug 'travel' already exists")

    monkeypatch.setattr(topic_router, "create_topic", fake_create_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.create_topic_route(TopicCreate(name="Travel"), db=db)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Topic slug 'travel' already exists"


def test_create_topic_route_maps_invalid_parent_to_400(monkeypatch) -> None:
    db = MagicMock()

    def fake_create_topic(db, payload):
        raise InvalidTopicParentError("Parent topic 99 not found")

    monkeypatch.setattr(topic_router, "create_topic", fake_create_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.create_topic_route(TopicCreate(name="Child", parent_topic_id=99), db=db)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Parent topic 99 not found"


def test_create_topic_route_maps_name_conflict_to_409(monkeypatch) -> None:
    db = MagicMock()

    def fake_create_topic(db, payload):
        raise TopicNameConflictError("Active topic name 'Travel' already exists")

    monkeypatch.setattr(topic_router, "create_topic", fake_create_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.create_topic_route(TopicCreate(name="Travel"), db=db)

    assert exc_info.value.status_code == 409
    assert "Travel" in exc_info.value.detail


def test_update_topic_route_raises_404_when_topic_is_missing(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: None)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.update_topic_route(1, TopicUpdate(name="New"), db=db)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Topic not found"


def test_update_topic_route_maps_name_conflict_to_409(monkeypatch) -> None:
    db = MagicMock()
    topic = MagicMock()
    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: topic)

    def fake_update_topic(db, topic_arg, payload):
        raise TopicNameConflictError("Active topic name 'Travel' already exists")

    monkeypatch.setattr(topic_router, "update_topic", fake_update_topic)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.update_topic_route(1, TopicUpdate(name="Travel"), db=db)

    assert exc_info.value.status_code == 409
    assert "Travel" in exc_info.value.detail


def test_delete_topic_calls_soft_delete_with_flag(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topic = make_topic(id=10)
    called = MagicMock()

    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: topic)
    monkeypatch.setattr(topic_router, "assert_topic_has_no_active_children", MagicMock())
    monkeypatch.setattr(topic_router, "soft_delete_topic", called)

    topic_router.delete_topic(10, delete_words=True, db=db)

    called.assert_called_once_with(db, topic, delete_words=True)


def test_delete_topic_maps_active_child_conflict_to_409(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topic = make_topic(id=10)
    soft_delete_called = MagicMock()

    monkeypatch.setattr(topic_router, "get_topic_by_id", lambda db, topic_id: topic)
    monkeypatch.setattr(
        topic_router,
        "assert_topic_has_no_active_children",
        MagicMock(side_effect=TopicHasActiveChildrenError(["Subtopic A"])),
    )
    monkeypatch.setattr(topic_router, "soft_delete_topic", soft_delete_called)

    with pytest.raises(HTTPException) as exc_info:
        topic_router.delete_topic(10, delete_words=False, db=db)

    assert exc_info.value.status_code == 409
    assert "Subtopic A" in exc_info.value.detail
    soft_delete_called.assert_not_called()


def test_audit_topics_returns_service_result(monkeypatch) -> None:
    db = MagicMock()
    expected = TopicAuditResponse(items=[])
    called = MagicMock(return_value=expected)
    monkeypatch.setattr(topic_router, "build_topic_audit", called)

    result = topic_router.audit_topics(db=db)

    assert result is expected
    called.assert_called_once_with(db)


def test_split_topic_plan_maps_missing_topic_to_404(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(topic_router, "build_topic_split_plan", MagicMock(side_effect=ValueError("missing")))

    with pytest.raises(HTTPException) as exc_info:
        topic_router.split_topic_plan(99, TopicSplitPlanRequest(), db=db)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Topic not found"
