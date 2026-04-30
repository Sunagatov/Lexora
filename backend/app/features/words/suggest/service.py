from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.features.topics.model import Topic

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """\
You are a vocabulary categorisation assistant.
Given an English word or phrase and its translation, pick the single best matching topic \
from the provided list.
Reply with ONLY the exact topic name from the list — nothing else, no explanation, no punctuation.\
"""


class AiNotConfiguredError(Exception):
    pass


class NoTopicsError(Exception):
    pass


class AiUnknownTopicError(Exception):
    pass


class AiMalformedResponseError(Exception):
    pass


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
        logger.warning(
            "word.suggest_topic.ai_not_configured",
            extra={"event": "word.suggest_topic.ai_not_configured"},
        )
        raise AiNotConfiguredError

    topic_names = list(db.scalars(select(Topic.name).where(Topic.deleted_at.is_(None)).order_by(Topic.name)).all())
    if not topic_names:
        logger.warning(
            "word.suggest_topic.no_topics",
            extra={"event": "word.suggest_topic.no_topics"},
        )
        raise NoTopicsError

    topic_list = "\n".join(f"- {topic_name}" for topic_name in topic_names)
    user_message = f"Word: {term}\nTranslation: {translation}\n\nTopics:\n{topic_list}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
        logger.warning("word.suggest_topic.timeout", extra={"event": "word.suggest_topic.timeout"})
        raise
    except httpx.HTTPStatusError as e:
        logger.error(
            "word.suggest_topic.http_error",
            extra={
                "event": "word.suggest_topic.http_error",
                "status_code": e.response.status_code,
            },
        )
        raise
    except httpx.RequestError as e:
        logger.error(
            "word.suggest_topic.request_error",
            extra={
                "event": "word.suggest_topic.request_error",
                "error_type": type(e).__name__,
            },
        )
        raise

    try:
        payload = response.json()
    except ValueError as e:
        logger.error("word.suggest_topic.invalid_json", extra={"event": "word.suggest_topic.invalid_json"})
        raise AiMalformedResponseError() from e

    suggested = _extract_choice_content(payload)
    exact_topic_names = set(topic_names)

    if suggested not in exact_topic_names:
        match = next((topic_name for topic_name in topic_names if topic_name.lower() == suggested.lower()), None)
        if match is None:
            logger.warning(
                "word.suggest_topic.unknown_topic",
                extra={
                    "event": "word.suggest_topic.unknown_topic",
                    "suggested_topic": suggested,
                },
            )
            raise AiUnknownTopicError(suggested)
        suggested = match

    return suggested
