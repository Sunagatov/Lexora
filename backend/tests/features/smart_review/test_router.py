from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.features.smart_review import router as smart_review_router
from app.features.smart_review.service import QueueItemNotFoundError, QueueNotActiveError


def _build_queue(make_topic, make_word, fixed_now):
    topic = make_topic(
        id=1,
        name="Travel",
        slug="travel",
        deleted_at=None,
        created_at=fixed_now,
        updated_at=fixed_now,
    )
    word = make_word(
        id=10,
        term="plane",
        translations="самолет",
        part_of_speech="noun",
        knowledge_level=2,
        topics=[topic],
        created_at=fixed_now,
        updated_at=fixed_now,
    )
    item = SimpleNamespace(
        id=100,
        word_id=10,
        position=0,
        is_completed=False,
        completed_at=None,
        word=word,
    )
    return SimpleNamespace(
        id=5,
        generated_at=fixed_now,
        expires_at=fixed_now + timedelta(days=1),
        is_active=True,
        total_count=1,
        completed_count=0,
        items=[item],
    )


def test_get_active_queue_returns_503_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr(smart_review_router, "get_or_create_active_queue", lambda db: None)

    with pytest.raises(HTTPException) as exc_info:
        smart_review_router.get_active_queue(db=object())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Smart Review is disabled"


def test_get_active_queue_returns_loaded_queue(monkeypatch, make_topic, make_word, fixed_now) -> None:
    queue = _build_queue(make_topic, make_word, fixed_now)

    monkeypatch.setattr(
        smart_review_router,
        "get_or_create_active_queue",
        lambda db: SimpleNamespace(id=queue.id),
    )
    monkeypatch.setattr(smart_review_router, "_load_queue", lambda db, queue_id: queue)

    result = smart_review_router.get_active_queue(db=object())

    assert result.id == 5
    assert result.total_count == 1
    assert result.completed_count == 0
    assert len(result.items) == 1
    assert result.items[0].word.term == "plane"


def test_refresh_queue_returns_503_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr(smart_review_router.settings, "smart_review_enabled", False)

    with pytest.raises(HTTPException) as exc_info:
        smart_review_router.refresh_queue(db=object())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Smart Review is disabled"


def test_refresh_queue_returns_loaded_queue(monkeypatch, make_topic, make_word, fixed_now) -> None:
    queue = _build_queue(make_topic, make_word, fixed_now)

    monkeypatch.setattr(smart_review_router.settings, "smart_review_enabled", True)
    monkeypatch.setattr(smart_review_router, "generate_queue", lambda db: SimpleNamespace(id=queue.id))
    monkeypatch.setattr(smart_review_router, "_load_queue", lambda db, queue_id: queue)

    result = smart_review_router.refresh_queue(db=object())

    assert result.id == 5
    assert len(result.items) == 1
    assert result.items[0].word_id == 10


def test_complete_item_maps_missing_item_to_404(monkeypatch) -> None:
    def fake_complete_queue_item(db, item_id):
        raise QueueItemNotFoundError

    monkeypatch.setattr(smart_review_router, "complete_queue_item", fake_complete_queue_item)

    with pytest.raises(HTTPException) as exc_info:
        smart_review_router.complete_item(123, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Queue item not found"


def test_complete_item_maps_inactive_queue_to_404(monkeypatch) -> None:
    def fake_complete_queue_item(db, item_id):
        raise QueueNotActiveError

    monkeypatch.setattr(smart_review_router, "complete_queue_item", fake_complete_queue_item)

    with pytest.raises(HTTPException) as exc_info:
        smart_review_router.complete_item(123, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Queue not found or inactive"


def test_complete_item_returns_loaded_queue(monkeypatch, make_topic, make_word, fixed_now) -> None:
    queue = _build_queue(make_topic, make_word, fixed_now)
    completed_queue_ref = SimpleNamespace(id=queue.id)

    monkeypatch.setattr(smart_review_router, "complete_queue_item", lambda db, item_id: completed_queue_ref)
    monkeypatch.setattr(smart_review_router, "_load_queue", lambda db, queue_id: queue)

    result = smart_review_router.complete_item(100, db=object())

    assert result.id == 5
    assert len(result.items) == 1
    assert result.items[0].position == 0
    assert result.items[0].word.term == "plane"