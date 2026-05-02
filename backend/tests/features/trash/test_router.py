from typing import cast
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.features.trash import router as trash_router
from app.features.topics.model import Topic
from app.features.topics.service import InvalidTopicParentError


def test_restore_word_route_raises_404_when_deleted_word_is_missing(monkeypatch) -> None:
    db = cast(Session, MagicMock())
    monkeypatch.setattr(
        trash_router,
        "restore_word_from_trash",
        MagicMock(side_effect=trash_router.DeletedWordNotFoundError),
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_word_route(1, db=db)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Deleted word not found"


def test_restore_word_route_raises_409_when_all_topics_are_deleted(monkeypatch, make_topic, make_word) -> None:
    db = cast(Session, MagicMock())
    deleted_topic = cast(Topic, make_topic(id=1, deleted_at=object()))
    make_word(id=1, deleted_at=object(), topics=[deleted_topic])

    monkeypatch.setattr(
        trash_router,
        "restore_word_from_trash",
        MagicMock(side_effect=trash_router.RestoreWordTopicDeletedError),
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_word_route(1, db=db)

    assert exc_info.value.status_code == 409
    assert "all its topics are deleted" in exc_info.value.detail


def test_restore_word_route_restores_and_returns_word_response(monkeypatch, make_topic, make_word) -> None:
    db = MagicMock()
    active_topic = make_topic(id=1, deleted_at=None, slug="travel")
    deleted_topic = make_topic(id=2, deleted_at=object(), slug="deleted")
    word = make_word(id=10, deleted_at=object(), topics=[active_topic, deleted_topic])
    word.deleted_at = None
    monkeypatch.setattr(trash_router, "restore_word_from_trash", lambda db, word_id: word)

    result = trash_router.restore_word_route(10, db=db)

    assert result.id == 10
    assert result.topic_ids == [1]
    assert result.deleted_at is None


def test_restore_word_route_raises_409_on_duplicate_term(monkeypatch, make_topic, make_word) -> None:
    db = cast(Session, MagicMock())
    active_topic = cast(Topic, make_topic(id=1, deleted_at=None, slug="travel"))
    word = make_word(id=10, term="plane", deleted_at=object(), topics=[active_topic])

    from app.features.words.exceptions import DuplicateWordInTopicError

    monkeypatch.setattr(
        trash_router,
        "restore_word_from_trash",
        MagicMock(side_effect=DuplicateWordInTopicError(word.term)),
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_word_route(10, db=db)

    assert exc_info.value.status_code == 409
    assert "plane" in exc_info.value.detail


def test_restore_topic_route_raises_404_when_topic_is_missing_or_not_deleted(monkeypatch, make_topic) -> None:
    db = cast(Session, MagicMock())
    monkeypatch.setattr(
        trash_router,
        "restore_topic_from_trash",
        MagicMock(side_effect=trash_router.DeletedTopicNotFoundError),
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_topic_route(5, db=db)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Deleted topic not found"


def test_restore_topic_route_raises_409_on_duplicate_term(monkeypatch, make_topic) -> None:
    db = cast(Session, MagicMock())

    from app.features.words.exceptions import DuplicateWordInTopicError

    monkeypatch.setattr(
        trash_router,
        "restore_topic_from_trash",
        MagicMock(side_effect=DuplicateWordInTopicError("plane")),
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_topic_route(5, restore_words=True, db=db)

    assert exc_info.value.status_code == 409
    assert "plane" in exc_info.value.detail


def test_restore_topic_route_raises_400_when_parent_is_deleted(monkeypatch, make_topic) -> None:
    db = cast(Session, MagicMock())
    monkeypatch.setattr(
        trash_router,
        "restore_topic_from_trash",
        MagicMock(
            side_effect=InvalidTopicParentError(
                "Cannot restore subtopic while its parent topic is deleted. Restore the parent first."
            )
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        trash_router.restore_topic_route(5, restore_words=True, db=db)

    assert exc_info.value.status_code == 400
    assert "Restore the parent first" in exc_info.value.detail


def test_purge_expired_forwards_force_flag(monkeypatch) -> None:
    db = cast(Session, MagicMock())
    purge = MagicMock()
    monkeypatch.setattr(trash_router, "purge_trash", purge)

    trash_router.purge_expired(db=db, force=True)

    purge.assert_called_once_with(db, force=True)
