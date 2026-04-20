from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.shared.deps import get_db, verify_api_key
from app.features.topics.service import assert_topics_exist, MissingTopicsError
from app.features.words.repository import (
    get_all_words, get_word_by_id, create_word, update_word, soft_delete_word,
)
from app.features.words.schemas import (
    BulkImportResponse,
    WordBulkCreate,
    WordCreate,
    WordResponse,
    WordUpdate,
    WorkbookImportResponse,
)
from app.features.words.workbook_service import (
    InvalidWorkbookError,
    build_words_workbook,
    import_words_workbook,
)
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.bulk_service import (
    BulkInvalidTopicNameError, BulkSlugConflictError, BulkTopicInTrashError, bulk_import,
)

router = APIRouter(prefix="/api/words", tags=["words"])


@router.get("", response_model=list[WordResponse])
def list_words(
    topic_id: int | None = Query(default=None, gt=0),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
) -> list[WordResponse]:
    return [WordResponse.from_word(w) for w in get_all_words(db, topic_id=topic_id, search=search)]


@router.post("/bulk", response_model=BulkImportResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_api_key)])
def bulk_create_words(payload: WordBulkCreate, db: Session = Depends(get_db)) -> BulkImportResponse:
    """Create or reuse a topic by name, then insert words skipping duplicates. Secured by X-Api-Key header."""
    try:
        return bulk_import(db, payload)
    except BulkInvalidTopicNameError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot generate a valid slug from topic name: '{e.name}'")
    except BulkTopicInTrashError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Topic '{e.name}' exists but is in trash. Restore or permanently delete it first.")
    except BulkSlugConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)


@router.get("/export/xlsx")
def export_words_xlsx(db: Session = Depends(get_db)) -> StreamingResponse:
    filename, content = build_words_workbook(db)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/xlsx", response_model=WorkbookImportResponse)
async def import_words_xlsx(
    request: Request,
    db: Session = Depends(get_db),
) -> WorkbookImportResponse:
    form = await request.form()
    file = form.get("file")
    if not isinstance(file, UploadFile):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .xlsx workbook",
        )

    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .xlsx workbook",
        )

    try:
        content = await file.read()
        return import_words_workbook(db, content)
    except InvalidWorkbookError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    finally:
        await file.close()


@router.get("/{word_id}", response_model=WordResponse)
def get_word(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    word = get_word_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return WordResponse.from_word(word)


@router.post("", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
def create_word_route(payload: WordCreate, db: Session = Depends(get_db)) -> WordResponse:
    try:
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
