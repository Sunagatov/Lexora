"""Optional OpenAI-compatible fallback; generated content is returned, never saved."""
import logging
from urllib.parse import urlsplit

import httpx

from app.features.words.enrich.gemini_client import (
    GeminiResult,
    enrichment_prompt,
    parse_enrichment_text,
)
from app.shared.config import settings

logger = logging.getLogger(__name__)
RETIRED_HOSTS = {"models.inference.ai.azure.com", "models.github.ai"}


async def fetch_openai(term: str, language: str = "en", translation_language: str = "ru") -> GeminiResult | None:
    if not settings.openai_api_key:
        return None
    base = settings.openai_base_url.rstrip("/")
    host = urlsplit(base).hostname
    if host in RETIRED_HOSTS or (host == "api.openai.com" and settings.openai_api_key.startswith(("ghp_", "github_pat_"))):
        logger.warning("enrichment_provider_not_configured", extra={"event": "enrichment_provider_not_configured"})
        return None
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.openai_model,
                    "messages": [
                        {"role": "system", "content": enrichment_prompt(language, translation_language)},
                        {"role": "user", "content": term},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 1800,
                },
            )
            response.raise_for_status()
            data = response.json()
            choice = data["choices"][0]
            if choice.get("finish_reason") == "length":
                return None
            return parse_enrichment_text(choice["message"]["content"])
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        logger.warning("openai_enrichment_error", extra={"event": "openai_enrichment_error", "model": settings.openai_model})
        return None
