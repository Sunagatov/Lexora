from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.shared.deps import get_db
from app.features.topics.model import Topic
from sqlalchemy import select

router = APIRouter(prefix="/api/words", tags=["words"])

SYSTEM_PROMPT = """\
You are a vocabulary categorisation assistant.
Given an English word or phrase and its translation, pick the single best matching topic \
from the provided list.
Reply with ONLY the exact topic name from the list — nothing else, no explanation, no punctuation.\
"""


class SuggestTopicRequest(BaseModel):
    term: str
    translation: str


class SuggestTopicResponse(BaseModel):
    topic_name: str


@router.post("/suggest-topic", response_model=SuggestTopicResponse)
async def suggest_topic(payload: SuggestTopicRequest, db: Session = Depends(get_db)) -> SuggestTopicResponse:
    if not settings.openai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI not configured")

    topics = db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.name)).all()
    if not topics:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No topics found")

    topic_list = "\n".join(f"- {t.name}" for t in topics)
    user_message = (
        f"Word: {payload.term}\n"
        f"Translation: {payload.translation}\n\n"
        f"Topics:\n{topic_list}"
    )

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
                        {"role": "user",   "content": user_message},
                    ],
                    "max_tokens": 40,
                    "temperature": 0,
                },
            )
            response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="AI request timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI connection error: {type(e).__name__}")

    suggested = response.json()["choices"][0]["message"]["content"].strip()

    # Validate the response is actually one of our topic names
    topic_names = {t.name for t in topics}
    if suggested not in topic_names:
        # fuzzy fallback: case-insensitive match
        match = next((t.name for t in topics if t.name.lower() == suggested.lower()), None)
        if match is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="AI returned unknown topic")
        suggested = match

    return SuggestTopicResponse(topic_name=suggested)
