from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.features.topics.model import Topic


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


async def suggest_topic_for_word(db: Session, term: str, translation: str) -> str:
    """Return the best matching topic name for the given term+translation. Raises domain errors on failure."""
    if not settings.openai_api_key:
        raise AiNotConfiguredError

    topics = db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name)).all()
    if not topics:
        raise NoTopicsError

    topic_list   = "\n".join(f"- {t.name}" for t in topics)
    user_message = f"Word: {term}\nTranslation: {translation}\n\nTopics:\n{topic_list}"

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
                    {"role": "user",   "content": user_message},
                ],
                "max_tokens": 40,
                "temperature": 0,
            },
        )
        response.raise_for_status()

    suggested   = response.json()["choices"][0]["message"]["content"].strip()
    topic_names = {t.name for t in topics}

    if suggested not in topic_names:
        match = next((t.name for t in topics if t.name.lower() == suggested.lower()), None)
        if match is None:
            raise AiUnknownTopicError(suggested)
        suggested = match

    return suggested
