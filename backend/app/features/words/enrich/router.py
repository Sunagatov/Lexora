from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, status

from app.features.words.enrich.dictionary_client import fetch_dictionary
from app.features.words.enrich.gemini_client import fetch_gemini
from app.features.words.enrich.merge import merge_enrichment
from app.features.words.enrich.schemas import EnrichRequest, EnrichResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/words", tags=["words"])


@router.post("/enrich", response_model=EnrichResponse)
async def enrich_word(payload: EnrichRequest) -> EnrichResponse:
    dict_result, ai_result = await asyncio.gather(
        fetch_dictionary(payload.term),
        fetch_gemini(payload.term),
    )

    if dict_result is None and ai_result is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Enrichment sources unavailable",
        )

    return merge_enrichment(payload.term, dict_result, ai_result)
