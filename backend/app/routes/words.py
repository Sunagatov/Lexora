import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, verify_api_key
from app.crud.topic import topic_crud
from app.crud.word import word_crud
from app.models.topic import Topic
from app.models.word import Word
from app.schemas.topic import TopicCreate
from app.schemas.word import BulkImportResponse, WordBulkCreate, WordCreate, WordInput, WordResponse, WordUpdate

router = APIRouter(prefix="/api/words", tags=["words"])
bulk_router = APIRouter(prefix="/api/words", tags=["words"])


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
    word_crud.soft_delete(db, word)


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.encode("ascii", "ignore").decode()).strip("-").lower()
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot build a slug from topic name: '{value}'")
    return slug[:200]


def _normalize_term(term: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", term)).strip().lower()


@bulk_router.post("/bulk", response_model=BulkImportResponse, status_code=status.HTTP_201_CREATED,
                  dependencies=[Depends(verify_api_key)])
def bulk_create_words(payload: WordBulkCreate, db: Session = Depends(get_db)) -> BulkImportResponse:
    """Create or reuse a topic by name, then insert words skipping duplicates. Secured by X-Api-Key header."""
    slug = _slugify(payload.topic_name)

    topic = db.scalar(select(Topic).where(Topic.name == payload.topic_name))
    if topic is None:
        existing_slug = topic_crud.get_by_slug(db, slug)
        if existing_slug is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Topic name '{payload.topic_name}' conflicts with existing topic '{existing_slug.name}' (same slug '{slug}'). Use the exact existing name.",
            )
        topic = topic_crud.create(db, TopicCreate(name=payload.topic_name, slug=slug))

    existing = {_normalize_term(t) for t in db.scalars(
        select(Word.term).where(Word.topic_id == topic.id)
    ).all()}

    added_terms: list[str] = []
    skipped_terms: list[str] = []
    for w in payload.words:
        if _normalize_term(w.term) in existing:
            skipped_terms.append(w.term)
            continue
        db.add(Word(**w.model_dump(), topic_id=topic.id))
        existing.add(_normalize_term(w.term))
        added_terms.append(w.term)

    db.commit()
    return BulkImportResponse(
        topic_id=topic.id,
        topic_name=topic.name,
        added=len(added_terms),
        skipped=len(skipped_terms),
        added_terms=added_terms,
        skipped_terms=skipped_terms,
    )