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
        fetch_dictionary(payload.term) if payload.language == "en" else asyncio.sleep(0, result=None),
        fetch_gemini(payload.term) if payload.language == "en" and payload.translation_language == "ru"
        else fetch_gemini(payload.term, payload.language, payload.translation_language),
    )

    if dict_result is None and ai_result is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Enrichment sources unavailable",
        )

    result = merge_enrichment(payload.term, dict_result, ai_result)
    if ai_result and ai_result.definition:
        result.definition = ai_result.definition
    if payload.language != "en":
        result.verb_form = None
    return result
