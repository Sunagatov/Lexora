from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.features.trash import router as trash_router


def test_restore_word_route_raises_404_when_deleted_word_is_missing(monkeypatch) -> None:
    monkeypatch.setattr(trash_router, "get_word_by_id_including_deleted", lambda db, word_id: None)

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_word_route(1, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Deleted word not found"


def test_restore_word_route_raises_409_when_all_topics_are_deleted(monkeypatch, make_topic, make_word) -> None:
    deleted_topic = make_topic(id=1, deleted_at=object())
    word = make_word(id=1, deleted_at=object(), topics=[deleted_topic])

    monkeypatch.setattr(trash_router, "get_word_by_id_including_deleted", lambda db, word_id: word)

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_word_route(1, db=object())

    assert exc_info.value.status_code == 409
    assert "all its topics are deleted" in exc_info.value.detail


def test_restore_word_route_restores_and_returns_word_response(monkeypatch, make_topic, make_word) -> None:
    active_topic = make_topic(id=1, deleted_at=None, slug="travel")
    deleted_topic = make_topic(id=2, deleted_at=object(), slug="deleted")
    word = make_word(id=10, deleted_at=object(), topics=[active_topic, deleted_topic])

    def fake_restore_word(db, word_arg):
        word_arg.deleted_at = None
        return word_arg

    monkeypatch.setattr(trash_router, "get_word_by_id_including_deleted", lambda db, word_id: word)
    monkeypatch.setattr(trash_router, "restore_word", fake_restore_word)

    result = trash_router.restore_word_route(10, db=object())

    assert result.id == 10
    assert result.topic_ids == [1]
    assert result.deleted_at is None


def test_restore_topic_route_raises_404_when_topic_is_missing_or_not_deleted(monkeypatch, make_topic) -> None:
    active_topic = make_topic(id=5, deleted_at=None)
    monkeypatch.setattr(
        trash_router,
        "get_topic_by_id_including_deleted",
        lambda db, topic_id: active_topic,
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_topic_route(5, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Deleted topic not found"


def test_purge_expired_forwards_force_flag(monkeypatch) -> None:
    purge = MagicMock()
    monkeypatch.setattr(trash_router, "purge_trash", purge)

    trash_router.purge_expired(db=object(), force=True)

    purge.assert_called_once_with(object(), force=True)