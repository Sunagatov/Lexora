from io import BytesIO
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import Field
from sqlalchemy.orm import Session

from app.features.languages.catalog import learning_language
from app.features.topics.exceptions import MissingTopicsError
from app.features.topics.rules import assert_topics_exist
from app.features.words.ai_review import (
    AiReviewExportResponse,
    AiReviewImportError,
    AiReviewImportRequest,
    AiReviewImportResponse,
    build_topic_ai_review_export,
    import_topic_ai_review,
)
from app.features.words.constants import KnowledgeLevel
from app.features.words.exceptions import DuplicateWordInTopicError, WordRequiresTopicError
from app.features.words.repository import (
    bulk_update_words,
    create_word,
    get_all_words,
    get_ordered_word_ids,
    get_word_by_id,
    get_word_knowledge_summary,
    soft_delete_word,
    update_word,
)
from app.features.words.schemas import (
    BatchUpdateRequest,
    BatchUpdateResponse,
    WordCreate,
    WordKnowledgeSummary,
    WordListResponse,
    WordResponse,
    WordUpdate,
)
from app.features.words.workbook import (
    build_words_workbook,
)
from app.features.words.workbook.flat import build_flat_workbook
from app.features.words.workbook.import_router import router as workbook_import_router
from app.shared.deps import get_db

router = APIRouter(prefix="/api/words", tags=["words"])
router.include_router(workbook_import_router)
WordSort = Literal["term-asc", "term-desc", "level-asc", "level-desc", "cefr-asc", "cefr-desc", "newest", "oldest"]


@router.get("", response_model=WordListResponse)
def list_words(
    topic_id: int | None = Query(default=None, gt=0),
    search: str | None = Query(default=None, min_length=1),
    pos: str | None = Query(default=None, min_length=1),
    cefr: str | None = Query(default=None, min_length=1),
    level: KnowledgeLevel | None = Query(default=None, ge=1, le=5),
    completeness: str | None = Query(default=None, pattern="^(complete|incomplete)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort: Annotated[WordSort, Query()] = "term-asc",
    db: Session = Depends(get_db),
    then_sort: Annotated[WordSort | Literal["none"] | None, Query()] = None,
    levels: Annotated[list[Annotated[KnowledgeLevel, Field(ge=1, le=5)]] | None, Query()] = None,
    positions: Annotated[list[Literal["noun", "verb", "adjective", "adverb", "phrase", "preposition", "phrasal verb", "other"]] | None, Query()] = None,
    cefr_levels: Annotated[list[Literal["A1", "A2", "B1", "B2", "C1", "C2"]] | None, Query()] = None,
    topic_ids: Annotated[list[Annotated[int, Field(gt=0)]] | None, Query()] = None,
    include_sequence: bool = False,
) -> WordListResponse:
    filters = {"topic_id": topic_id, "search": search, "pos": pos, "cefr": cefr,
        "level": level, "completeness": completeness, "levels": levels, "positions": positions,
        "cefr_levels": cefr_levels, "topic_ids": topic_ids}
    words, total = get_all_words(db, page=page, page_size=page_size, sort=sort, then_sort=then_sort, **filters)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return WordListResponse(
        words=[WordResponse.from_word(w) for w in words],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        ordered_ids=get_ordered_word_ids(db, sort=sort, then_sort=then_sort, **filters) if include_sequence else None,
    )


@router.get("/summary", response_model=WordKnowledgeSummary)
def word_knowledge_summary(db: Annotated[Session, Depends(get_db)]) -> WordKnowledgeSummary:
    counts = get_word_knowledge_summary(db)
    return WordKnowledgeSummary(total=sum(counts.values()), level_counts=counts)


@router.patch("/batch", response_model=BatchUpdateResponse)
def batch_update_words(
    payload: BatchUpdateRequest,
    db: Session = Depends(get_db),
) -> BatchUpdateResponse:
    try:
        updated = bulk_update_words(
            db,
            word_ids=payload.word_ids,
            knowledge_level=payload.knowledge_level,
            add_topic_ids=payload.add_topic_ids,
            remove_topic_ids=payload.remove_topic_ids,
        )
    except (MissingTopicsError, WordRequiresTopicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return BatchUpdateResponse(updated=updated)


@router.get("/export/xlsx")
def export_words_xlsx(layout: Literal["topics", "flat"] = "topics", db: Session = Depends(get_db)) -> StreamingResponse:
    if layout == "flat":
        filename, content = "lexora-vocabulary.xlsx", build_flat_workbook(db)
    else:
        filename, content = build_words_workbook(db)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/xlsx", deprecated=True)
def import_words_xlsx():
    raise HTTPException(409, "Preview the workbook at /api/words/import/xlsx/preview, then apply its reviewed plan")


@router.get("/export/ai-review", response_model=AiReviewExportResponse)
def export_words_ai_review(
    topic_id: int = Query(gt=0),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AiReviewExportResponse:
    try:
        return build_topic_ai_review_export(db, topic_id=topic_id, page=page, page_size=page_size)
    except AiReviewImportError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/import/ai-review", response_model=AiReviewImportResponse)
def import_words_ai_review(
    payload: AiReviewImportRequest,
    db: Session = Depends(get_db),
) -> AiReviewImportResponse:
    try:
        return import_topic_ai_review(db, payload)
    except AiReviewImportError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{word_id}", response_model=WordResponse)
def get_word(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    word = get_word_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return WordResponse.from_word(word)


@router.post("", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
def create_word_route(payload: WordCreate, db: Session = Depends(get_db)) -> WordResponse:
    try:
        if "language" in payload.model_fields_set and payload.language != learning_language(db):
            raise HTTPException(400, "The word must use the selected learning language")
        assert_topics_exist(db, payload.topic_ids)
        return WordResponse.from_word(create_word(db, payload))
    except MissingTopicsError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.put("/{word_id}", response_model=WordResponse)
def update_word_route(word_id: int, payload: WordUpdate, db: Session = Depends(get_db)) -> WordResponse:
    word = get_word_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    try:
        if payload.language is not None and payload.language != word.language:
            raise HTTPException(400, "A word cannot be moved to another learning language by editing it")
        if payload.topic_ids is not None:
            assert_topics_exist(db, payload.topic_ids)
        return WordResponse.from_word(update_word(db, word, payload))
    except MissingTopicsError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word_route(word_id: int, db: Session = Depends(get_db)) -> None:
    word = get_word_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    soft_delete_word(db, word)
