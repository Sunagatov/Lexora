from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.topics.repository import (
    get_deleted_topics, get_topic_by_id_including_deleted, restore_topic,
)
from app.features.topics.schemas import TopicResponse
from app.features.words.domain import assert_word_restore_allowed
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.repository import (
    get_deleted_words, get_word_by_id_including_deleted, restore_word,
)
from app.features.words.schemas import WordResponse
from app.features.trash.service import purge_trash

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.get("/words", response_model=list[WordResponse])
def list_deleted_words(db: Session = Depends(get_db)) -> list[WordResponse]:
    return [WordResponse.from_word(w) for w in get_deleted_words(db)]


@router.get("/topics", response_model=list[TopicResponse])
def list_deleted_topics(db: Session = Depends(get_db)) -> list[TopicResponse]:
    return get_deleted_topics(db)


@router.post("/words/{word_id}/restore", response_model=WordResponse)
def restore_word_route(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    word = get_word_by_id_including_deleted(db, word_id)
    if word is None or word.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted word not found")
    active_topics = [t for t in word.topics if t.deleted_at is None]
    if not active_topics:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restore word: all its topics are deleted. Restore a topic first.",
        )
    try:
        assert_word_restore_allowed(db, word)
        return WordResponse.from_word(restore_word(db, word))
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/topics/{topic_id}/restore", response_model=TopicResponse)
def restore_topic_route(topic_id: int, restore_words: bool = False, db: Session = Depends(get_db)) -> TopicResponse:
    topic = get_topic_by_id_including_deleted(db, topic_id)
    if topic is None or topic.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted topic not found")
    try:
        return restore_topic(db, topic, restore_words=restore_words)
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/purge", status_code=status.HTTP_204_NO_CONTENT)
def purge_expired(db: Session = Depends(get_db), force: bool = False) -> None:
    """Hard-delete trashed items. With force=true deletes all; otherwise only items older than retention days."""
    purge_trash(db, force=force)
