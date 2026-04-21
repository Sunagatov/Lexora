import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.words.suggest import service as suggest_service


class FakeResponse:
    def __init__(self, content: str):
        self._content = content

    @staticmethod
    def raise_for_status() -> None:
        return None

    def json(self) -> dict[str, object]:
        return {
            "choices": [
                {
                    "message": {
                        "content": self._content,
                    }
                }
            ]
        }


class FakeAsyncClient:
    last_request: dict[str, object] | None = None

    def __init__(self, *args, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers, json):
        FakeAsyncClient.last_request = {
            "url": url,
            "headers": headers,
            "json": json,
        }
        return FakeResponse("travel")


def test_suggest_topic_for_word_raises_when_ai_not_configured(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(suggest_service.settings, "openai_api_key", "")

    with pytest.raises(suggest_service.AiNotConfiguredError):
        asyncio.run(suggest_service.suggest_topic_for_word(db, "run", "бежать"))


def test_suggest_topic_for_word_raises_when_no_topics_exist(monkeypatch) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = []

    monkeypatch.setattr(suggest_service.settings, "openai_api_key", "token")

    with pytest.raises(suggest_service.NoTopicsError):
        asyncio.run(suggest_service.suggest_topic_for_word(db, "run", "бежать"))


def test_suggest_topic_for_word_returns_case_insensitive_match(monkeypatch) -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(name="Travel", deleted_at=None),
        SimpleNamespace(name="Work", deleted_at=None),
    ]

    monkeypatch.setattr(suggest_service.settings, "openai_api_key", "token")
    monkeypatch.setattr(suggest_service.settings, "openai_base_url", "https://example.test")
    monkeypatch.setattr(suggest_service.settings, "openai_model", "gpt-test")
    monkeypatch.setattr(suggest_service.httpx, "AsyncClient", FakeAsyncClient)

    result = asyncio.run(suggest_service.suggest_topic_for_word(db, "plane", "самолет"))

    assert result == "Travel"
    assert FakeAsyncClient.last_request["url"] == "https://example.test/chat/completions"
    assert FakeAsyncClient.last_request["json"]["model"] == "gpt-test"
    assert "Word: plane" in FakeAsyncClient.last_request["json"]["messages"][1]["content"]
    assert "Translation: самолет" in FakeAsyncClient.last_request["json"]["messages"][1]["content"]
    assert "- Travel" in FakeAsyncClient.last_request["json"]["messages"][1]["content"]


def test_extract_choice_content_raises_on_empty_choices(monkeypatch) -> None:
    with pytest.raises(suggest_service.AiMalformedResponseError):
        suggest_service._extract_choice_content({"choices": []})


def test_extract_choice_content_raises_on_missing_choices_key(monkeypatch) -> None:
    with pytest.raises(suggest_service.AiMalformedResponseError):
        suggest_service._extract_choice_content({})


def test_extract_choice_content_raises_on_non_string_content(monkeypatch) -> None:
    with pytest.raises(suggest_service.AiMalformedResponseError):
        suggest_service._extract_choice_content({"choices": [{"message": {"content": 123}}]})


def test_extract_choice_content_raises_on_non_dict_input(monkeypatch) -> None:
    with pytest.raises(suggest_service.AiMalformedResponseError):
        suggest_service._extract_choice_content("not a dict")


def test_suggest_topic_for_word_raises_malformed_on_empty_choices_response(monkeypatch) -> None:
    class EmptyChoicesClient(FakeAsyncClient):
        async def post(self, url, headers, json):
            class Resp:
                @staticmethod
                def raise_for_status() -> None:
                    return None

                @staticmethod
                def json() -> dict[str, list[object]]:
                    return {"choices": []}
            return Resp()

    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(name="Travel", deleted_at=None),
    ]

    monkeypatch.setattr(suggest_service.settings, "openai_api_key", "token")
    monkeypatch.setattr(suggest_service.httpx, "AsyncClient", EmptyChoicesClient)

    with pytest.raises(suggest_service.AiMalformedResponseError):
        asyncio.run(suggest_service.suggest_topic_for_word(db, "plane", "самолет"))


def test_suggest_topic_for_word_raises_for_unknown_topic(monkeypatch) -> None:
    class UnknownTopicClient(FakeAsyncClient):
        async def post(self, url, headers, json):
            return FakeResponse("Animals")

    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(name="Travel", deleted_at=None),
        SimpleNamespace(name="Work", deleted_at=None),
    ]

    monkeypatch.setattr(suggest_service.settings, "openai_api_key", "token")
    monkeypatch.setattr(suggest_service.httpx, "AsyncClient", UnknownTopicClient)

    with pytest.raises(suggest_service.AiUnknownTopicError):
        asyncio.run(suggest_service.suggest_topic_for_word(db, "plane", "самолет"))
