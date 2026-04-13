from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db, verify_api_key
from app.features.topics.service import assert_topics_exist, MissingTopicsError
from app.features.words.repository import word_repo
from app.features.words.schemas import BulkImportResponse, WordBulkCreate, WordCreate, WordResponse, WordUpdate
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
    return [WordResponse.from_word(w) for w in word_repo.get_all(db, topic_id=topic_id, search=search)]


@router.get("/{word_id}", response_model=WordResponse)
def get_word(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    word = word_repo.get_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return WordResponse.from_word(word)


@router.post("", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
def create_word(payload: WordCreate, db: Session = Depends(get_db)) -> WordResponse:
    try:
        assert_topics_exist(db, payload.topic_ids)
        return WordResponse.from_word(word_repo.create(db, payload))
    except MissingTopicsError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.put("/{word_id}", response_model=WordResponse)
def update_word(word_id: int, payload: WordUpdate, db: Session = Depends(get_db)) -> WordResponse:
    word = word_repo.get_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    try:
        if payload.topic_ids is not None:
            assert_topics_exist(db, payload.topic_ids)
        return WordResponse.from_word(word_repo.update(db, word, payload))
    except MissingTopicsError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word(word_id: int, db: Session = Depends(get_db)) -> None:
    word = word_repo.get_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    word_repo.soft_delete(db, word)


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
