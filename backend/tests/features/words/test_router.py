from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.features.topics.service import MissingTopicsError
from app.features.words import router as words_router
from app.features.words.bulk.service import BulkTopicInTrashError
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.ai_review.schemas import AiReviewImportRequest
from app.features.words.ai_review.service import AiReviewImportError
from app.features.words.schemas import WordBulkCreate, WordCreate, WordInput, WordUpdate


def test_get_word_raises_404_when_missing(monkeypatch) -> None:
    monkeypatch.setattr(words_router, "get_word_by_id", lambda db, word_id: None)

    with pytest.raises(HTTPException) as exc_info:
        words_router.get_word(1, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Word not found"


def test_create_word_route_maps_missing_topics_to_400(monkeypatch) -> None:
    def fake_assert_topics_exist(db, topic_ids):
        raise MissingTopicsError(topic_ids)

    monkeypatch.setattr(words_router, "assert_topics_exist", fake_assert_topics_exist)

    payload = WordCreate(topic_ids=[9], term="run", translations="бежать")

    with pytest.raises(HTTPException) as exc_info:
        words_router.create_word_route(payload, db=object())

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Topics not found: [9]"


def test_update_word_route_maps_duplicate_word_to_409(monkeypatch) -> None:
    monkeypatch.setattr(words_router, "get_word_by_id", lambda db, word_id: SimpleNamespace(id=word_id))
    monkeypatch.setattr(words_router, "assert_topics_exist", lambda db, topic_ids: None)

    def fake_update_word(db, word, payload):
        raise DuplicateWordInTopicError(payload.term or "term")

    monkeypatch.setattr(words_router, "update_word", fake_update_word)

    payload = WordUpdate(topic_ids=[1], term="run")

    with pytest.raises(HTTPException) as exc_info:
        words_router.update_word_route(1, payload, db=object())

    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail


def test_delete_word_route_raises_404_when_missing(monkeypatch) -> None:
    monkeypatch.setattr(words_router, "get_word_by_id", lambda db, word_id: None)

    with pytest.raises(HTTPException) as exc_info:
        words_router.delete_word_route(1, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Word not found"


def test_bulk_create_words_maps_topic_in_trash_to_409(monkeypatch) -> None:
    def fake_bulk_import(db, payload):
        raise BulkTopicInTrashError(payload.topic_name)

    monkeypatch.setattr(words_router, "bulk_import", fake_bulk_import)

    payload = WordBulkCreate(
        topic_name="Travel",
        words=[WordInput(term="stay", translations="остаться")],
    )

    with pytest.raises(HTTPException) as exc_info:
        words_router.bulk_create_words(payload, db=object())

    assert exc_info.value.status_code == 409
    assert "exists but is in trash" in exc_info.value.detail


def test_export_words_ai_review_maps_missing_topic_to_404(monkeypatch) -> None:
    def fake_export(db, topic_id, page, page_size):
        raise AiReviewImportError(f"Topic {topic_id} not found")

    monkeypatch.setattr(words_router, "build_topic_ai_review_export", fake_export)

    with pytest.raises(HTTPException) as exc_info:
        words_router.export_words_ai_review(topic_id=99, db=object())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Topic 99 not found"


def test_import_words_ai_review_maps_invalid_payload_to_400(monkeypatch) -> None:
    def fake_import(db, payload):
        raise AiReviewImportError("Word 10 term mismatch")

    monkeypatch.setattr(words_router, "import_topic_ai_review", fake_import)

    payload = AiReviewImportRequest(
        topic_id=1,
        words=[{"id": 10, "term": "run", "example_entries": ["I run every morning."]}],
    )

    db = MagicMock()
    with pytest.raises(HTTPException) as exc_info:
        words_router.import_words_ai_review(payload, db=db)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Word 10 term mismatch"
    db.rollback.assert_called_once()
