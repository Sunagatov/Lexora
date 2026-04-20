import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app.features.words import suggest_router
from app.features.words.suggest_schemas import SuggestTopicRequest
from app.features.words.suggest_service import AiMalformedResponseError, AiNotConfiguredError, AiUnknownTopicError, NoTopicsError


def test_suggest_topic_returns_response_model(monkeypatch) -> None:
    async def fake_suggest_topic_for_word(db, term, translation):
        return "Travel"

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    result = asyncio.run(
        suggest_router.suggest_topic(
            SuggestTopicRequest(term="run", translation="бежать"),
            db=object(),
        )
    )

    assert result.topic_name == "Travel"


def test_suggest_topic_maps_ai_not_configured_to_503(monkeypatch) -> None:
    async def fake_suggest_topic_for_word(db, term, translation):
        raise AiNotConfiguredError()

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "AI not configured"


def test_suggest_topic_maps_no_topics_to_404(monkeypatch) -> None:
    async def fake_suggest_topic_for_word(db, term, translation):
        raise NoTopicsError()

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "No topics found"


def test_suggest_topic_maps_unknown_topic_to_422(monkeypatch) -> None:
    async def fake_suggest_topic_for_word(db, term, translation):
        raise AiUnknownTopicError("unknown")

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "AI returned unknown topic"


def test_suggest_topic_maps_timeout_to_504(monkeypatch) -> None:
    async def fake_suggest_topic_for_word(db, term, translation):
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 504
    assert exc_info.value.detail == "AI request timed out"


def test_suggest_topic_maps_http_status_error_to_502(monkeypatch) -> None:
    request = httpx.Request("POST", "https://example.test")
    response = httpx.Response(429, request=request)

    async def fake_suggest_topic_for_word(db, term, translation):
        raise httpx.HTTPStatusError("boom", request=request, response=response)

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "AI error: 429"


def test_suggest_topic_maps_malformed_response_to_502(monkeypatch) -> None:
    async def fake_suggest_topic_for_word(db, term, translation):
        raise AiMalformedResponseError()

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "AI returned malformed response"


def test_suggest_topic_maps_request_error_to_502(monkeypatch) -> None:
    request = httpx.Request("POST", "https://example.test")

    async def fake_suggest_topic_for_word(db, term, translation):
        raise httpx.RequestError("down", request=request)

    monkeypatch.setattr(suggest_router, "suggest_topic_for_word", fake_suggest_topic_for_word)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            suggest_router.suggest_topic(
                SuggestTopicRequest(term="run", translation="бежать"),
                db=object(),
            )
        )

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "AI connection error: RequestError"