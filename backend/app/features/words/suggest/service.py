from __future__ import annotations

import logging
import time

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.features.topics.model import Topic
from app.features.words.suggest.exceptions import (
    AiMalformedResponseError,
    AiNotConfiguredError,
    AiUnknownTopicError,
    NoTopicsError,
)

logger = logging.getLogger(__name__)
AI_PROVIDER = "openai_compatible"
AI_REQUEST_TIMEOUT_SECONDS = 10.0


SYSTEM_PROMPT = """\
You are a vocabulary categorisation assistant.
Given an English word or phrase and its translation, pick the single best matching topic \
from the provided list.
Reply with ONLY the exact topic name from the list — nothing else, no explanation, no punctuation.\
"""
def _extract_choice_content(data: object) -> str:
    if not isinstance(data, dict):
        raise AiMalformedResponseError()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise AiMalformedResponseError()
    if not isinstance(content, str) or not content.strip():
        raise AiMalformedResponseError()
    return content.strip()


async def suggest_topic_for_word(db: Session, term: str, translation: str) -> str:
    """Return the best matching topic name for the given term+translation. Raises domain errors on failure."""
    if not settings.openai_api_key:
        raise AiNotConfiguredError

    topic_names = list(db.scalars(select(Topic.name).where(Topic.deleted_at.is_(None)).order_by(Topic.name)).all())
    if not topic_names:
        raise NoTopicsError

    topic_list = "\n".join(f"- {topic_name}" for topic_name in topic_names)
    user_message = f"Word: {term}\nTranslation: {translation}\n\nTopics:\n{topic_list}"

    started_at = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 40,
                    "temperature": 0,
                },
            )
            response.raise_for_status()
    except httpx.TimeoutException:
        logger.warning(
            "topic_suggestion_provider_timeout",
            extra={
                "event": "topic_suggestion_provider_timeout",
                "provider": AI_PROVIDER,
                "model": settings.openai_model,
                "timeout_ms": round(AI_REQUEST_TIMEOUT_SECONDS * 1000),
            },
        )
        raise
    except httpx.HTTPStatusError as e:
        logger.warning(
            "topic_suggestion_provider_http_error",
            extra={
                "event": "topic_suggestion_provider_http_error",
                "provider": AI_PROVIDER,
                "model": settings.openai_model,
                "status_code": e.response.status_code,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
        )
        raise
    except httpx.RequestError as e:
        logger.warning(
            "topic_suggestion_provider_request_failed",
            extra={
                "event": "topic_suggestion_provider_request_failed",
                "provider": AI_PROVIDER,
                "model": settings.openai_model,
                "error_type": type(e).__name__,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
        )
        raise

    try:
        payload = response.json()
    except ValueError as e:
        logger.error(
            "topic_suggestion_provider_invalid_json",
            extra={
                "event": "topic_suggestion_provider_invalid_json",
                "provider": AI_PROVIDER,
                "model": settings.openai_model,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
        )
        raise AiMalformedResponseError() from e

    suggested = _extract_choice_content(payload)
    exact_topic_names = set(topic_names)

    if suggested not in exact_topic_names:
        match = next((topic_name for topic_name in topic_names if topic_name.lower() == suggested.lower()), None)
        if match is None:
            logger.warning(
                "topic_suggestion_unknown_topic",
                extra={
                    "event": "topic_suggestion_unknown_topic",
                    "provider": AI_PROVIDER,
                    "model": settings.openai_model,
                    "suggested_topic": suggested,
                },
            )
            raise AiUnknownTopicError(suggested)
        suggested = match

    return suggested
