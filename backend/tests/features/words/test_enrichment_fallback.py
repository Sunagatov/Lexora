import asyncio
import importlib
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from app.features.words.enrich import openai_client
from app.features.words.enrich.gemini_client import GeminiResult
from app.features.words.enrich.schemas import EnrichRequest

router = importlib.import_module("app.features.words.enrich.router")


def test_non_english_enrichment_uses_fallback_without_saving(monkeypatch):
    monkeypatch.setattr(router, "fetch_gemini", AsyncMock(return_value=None))
    fallback = AsyncMock(return_value=GeminiResult(
        definition="Приветствие", translation_entries=["привет"],
        verb_form={"past_simple": "invalid English form"},
    ))
    monkeypatch.setattr(router, "fetch_openai", fallback)
    result = asyncio.run(router.enrich_word(EnrichRequest(
        term="hola", language="es", translation_language="ru",
    )))
    fallback.assert_awaited_once_with("hola", "es", "ru")
    assert result.definition == "Приветствие"
    assert result.translation_entries == ["привет"]
    assert result.verb_form is None


def test_working_primary_provider_does_not_call_fallback(monkeypatch):
    monkeypatch.setattr(router, "fetch_gemini", AsyncMock(return_value=GeminiResult(definition="Привет")))
    fallback = AsyncMock()
    monkeypatch.setattr(router, "fetch_openai", fallback)
    asyncio.run(router.enrich_word(EnrichRequest(term="hola", language="es")))
    fallback.assert_not_awaited()


def test_provider_failure_remains_explicit(monkeypatch):
    monkeypatch.setattr(router, "fetch_gemini", AsyncMock(return_value=None))
    monkeypatch.setattr(router, "fetch_openai", AsyncMock(return_value=None))
    with pytest.raises(HTTPException) as error:
        asyncio.run(router.enrich_word(EnrichRequest(term="hola", language="es")))
    assert error.value.status_code == 503


@pytest.mark.parametrize("base,key", [
    ("https://models.inference.ai.azure.com", "test-key"),
    ("https://models.github.ai/inference", "test-key"),
    ("https://api.openai.com/v1", "ghp_test-not-a-real-key"),
    ("https://api.openai.com/v1", ""),
])
def test_missing_or_retired_credentials_never_make_request(monkeypatch, base, key):
    monkeypatch.setattr(openai_client.settings, "openai_base_url", base)
    monkeypatch.setattr(openai_client.settings, "openai_api_key", key)
    client = AsyncMock()
    monkeypatch.setattr(openai_client.httpx, "AsyncClient", client)
    assert asyncio.run(openai_client.fetch_openai("hola", "es")) is None
    client.assert_not_called()


@pytest.mark.parametrize("content,finish,expected", [
    ('{"definition":"Приветствие","translation_entries":["привет"]}', "stop", True),
    ('{"definition":"cut off', "length", False),
    ('not JSON', "stop", False),
    (None, "stop", False),
])
def test_fallback_parses_or_rejects_provider_output(monkeypatch, content, finish, expected):
    monkeypatch.setattr(openai_client.settings, "openai_base_url", "https://api.openai.com/v1")
    monkeypatch.setattr(openai_client.settings, "openai_api_key", "test-key")
    captured = {}

    async def handler(request):
        import json
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{
            "finish_reason": finish, "message": {"content": content},
        }]})

    client_class = httpx.AsyncClient
    monkeypatch.setattr(openai_client.httpx, "AsyncClient", lambda **kwargs: client_class(
        transport=httpx.MockTransport(handler), **kwargs,
    ))
    result = asyncio.run(openai_client.fetch_openai("hola", "es", "ru"))
    assert (result is not None) is expected
    assert "Russian" in captured["messages"][0]["content"]
    assert "Spanish" in captured["messages"][0]["content"]
    assert captured["messages"][1]["content"] == "hola"
