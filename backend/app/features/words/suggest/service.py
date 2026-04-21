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
        logger.warning("word.suggest_topic.ai_not_configured")
        raise AiNotConfiguredError

    topics = db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name)).all()
    if not topics:
        logger.warning("word.suggest_topic.no_topics")
        raise NoTopicsError

    topic_list = "\n".join(f"- {topic.name}" for topic in topics)
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
        logger.warning("word.suggest_topic.timeout")
        raise
    except httpx.HTTPStatusError as e:
        logger.error("word.suggest_topic.http_error: status=%s", e.response.status_code)
        raise
    except httpx.RequestError as e:
        logger.error("word.suggest_topic.request_error: type=%s", type(e).__name__)
        raise

    try:
        payload = response.json()
    except ValueError as e:
        logger.error("word.suggest_topic.invalid_json")
        raise AiMalformedResponseError() from e

    suggested = _extract_choice_content(payload)
    topic_names = {topic.name for topic in topics}

    if suggested not in topic_names:
        match = next((topic.name for topic in topics if topic.name.lower() == suggested.lower()), None)
        if match is None:
            logger.warning("word.suggest_topic.unknown_topic")
            raise AiUnknownTopicError(suggested)
        suggested = match

    return suggested
