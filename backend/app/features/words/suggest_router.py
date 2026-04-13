from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.words.suggest_schemas import SuggestTopicRequest, SuggestTopicResponse
from app.features.words.suggest_service import (
    AiNotConfiguredError, AiUnknownTopicError, NoTopicsError, suggest_topic_for_word,
)

router = APIRouter(prefix="/api/words", tags=["words"])


@router.post("/suggest-topic", response_model=SuggestTopicResponse)
async def suggest_topic(payload: SuggestTopicRequest, db: Session = Depends(get_db)) -> SuggestTopicResponse:
    try:
        topic_name = await suggest_topic_for_word(db, payload.term, payload.translation)
    except AiNotConfiguredError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI not configured")
    except NoTopicsError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No topics found")
    except AiUnknownTopicError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="AI returned unknown topic")
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="AI request timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI connection error: {type(e).__name__}")
    return SuggestTopicResponse(topic_name=topic_name)
