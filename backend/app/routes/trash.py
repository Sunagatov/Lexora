from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.crud.topic import topic_crud
from app.crud.word import word_crud
from app.schemas.topic import TopicResponse
from app.schemas.word import WordResponse

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.get("/words", response_model=list[WordResponse])
def list_deleted_words(db: Session = Depends(get_db)) -> list[WordResponse]:
    return word_crud.get_deleted(db)


@router.get("/topics", response_model=list[TopicResponse])
def list_deleted_topics(db: Session = Depends(get_db)) -> list[TopicResponse]:
    return topic_crud.get_deleted(db)


@router.post("/words/{word_id}/restore", response_model=WordResponse)
def restore_word(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    word = word_crud.get_by_id(db, word_id)
    if word is None or word.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted word not found")
    return word_crud.restore(db, word)


@router.post("/topics/{topic_id}/restore", response_model=TopicResponse)
def restore_topic(
    topic_id: int,
    restore_words: bool = False,
    db: Session = Depends(get_db),
) -> TopicResponse:
    topic = topic_crud.get_by_id(db, topic_id)
    if topic is None or topic.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted topic not found")
    return topic_crud.restore(db, topic, restore_words=restore_words)


@router.delete("/purge", status_code=status.HTTP_204_NO_CONTENT)
def purge_expired(db: Session = Depends(get_db)) -> None:
    """Hard delete all items that have been in trash longer than retention period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.trash_retention_days)

    for word in word_crud.get_deleted(db):
        if word.deleted_at and word.deleted_at < cutoff:
            word_crud.hard_delete(db, word)

    for topic in topic_crud.get_deleted(db):
        if topic.deleted_at and topic.deleted_at < cutoff:
            topic_crud.hard_delete(db, topic)
