from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.words.ai_curation.schemas import (
    AiCurationImportRequest,
    AiCurationImportResponse,
    AiCurationTopicListResponse,
    AiCurationTopicWordsLeanResponse,
    AiCurationTopicWordsResponse,
)
from app.features.words.ai_curation.service import (
    AiCurationImportError,
    export_topic_words_lean_page,
    export_topic_words_page,
    import_ai_curation,
    list_topics_page,
)

router = APIRouter(prefix="/api/ai-curation", tags=["ai-curation"])


@router.get("/topics", response_model=AiCurationTopicListResponse)
def list_ai_curation_topics(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> AiCurationTopicListResponse:
    return list_topics_page(db, page=page, page_size=page_size)


@router.get("/topics/{topic_id}/words", response_model=AiCurationTopicWordsResponse)
def list_ai_curation_topic_words(
    topic_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> AiCurationTopicWordsResponse:
    try:
        return export_topic_words_page(db, topic_id=topic_id, page=page, page_size=page_size)
    except AiCurationImportError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/topics/{topic_id}/export",
    response_model=AiCurationTopicWordsLeanResponse | AiCurationTopicWordsResponse,
    response_model_exclude_none=True,
)
def export_ai_curation_topic(
    topic_id: int,
    lean: bool = Query(default=False, description="Return minimal export (id, term, examples only) for ChatGPT enrichment"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> AiCurationTopicWordsLeanResponse | AiCurationTopicWordsResponse:
    try:
        if lean:
            return export_topic_words_lean_page(db, topic_id=topic_id, page=page, page_size=page_size)
        return export_topic_words_page(db, topic_id=topic_id, page=page, page_size=page_size)
    except AiCurationImportError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/import", response_model=AiCurationImportResponse)
def import_ai_curation_payload(
    payload: AiCurationImportRequest,
    db: Session = Depends(get_db),
) -> AiCurationImportResponse:
    try:
        return import_ai_curation(db, payload)
    except AiCurationImportError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
