from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.crud.topic import topic_crud
from app.crud.word import word_crud
from app.schemas.word import WordCreate, WordResponse, WordUpdate

router = APIRouter(prefix="/api/words", tags=["words"])


@router.get("", response_model=list[WordResponse])
def list_words(
        topic_id: int | None = Query(default=None, gt=0),
        search: str | None = Query(default=None, min_length=1),
        db: Session = Depends(get_db),
) -> list[WordResponse]:
    return word_crud.get_all(db, topic_id=topic_id, search=search)


@router.get("/{word_id}", response_model=WordResponse)
def get_word(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    word = word_crud.get_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return word


@router.post("", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
def create_word(payload: WordCreate, db: Session = Depends(get_db)) -> WordResponse:
    topic = topic_crud.get_by_id(db, payload.topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Topic does not exist")
    return word_crud.create(db, payload)


@router.put("/{word_id}", response_model=WordResponse)
def update_word(word_id: int, payload: WordUpdate, db: Session = Depends(get_db)) -> WordResponse:
    word = word_crud.get_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")

    if payload.topic_id is not None:
        topic = topic_crud.get_by_id(db, payload.topic_id)
        if topic is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Topic does not exist")

    return word_crud.update(db, word, payload)


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word(word_id: int, db: Session = Depends(get_db)) -> None:
    word = word_crud.get_by_id(db, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    word_crud.delete(db, word)