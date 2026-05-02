from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.features.topics.exceptions import InvalidTopicParentError
from app.features.topics.schemas import TopicResponse
from app.features.trash.service import (
    DeletedTopicNotFoundError,
    DeletedWordNotFoundError,
    RestoreWordTopicDeletedError,
    list_deleted_topics_in_trash,
    list_deleted_words_in_trash,
    purge_trash,
    restore_topic_from_trash,
    restore_word_from_trash,
)
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.schemas import WordResponse
from app.shared.deps import get_db

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.get("/words", response_model=list[WordResponse])
def list_deleted_words(db: Session = Depends(get_db)) -> list[WordResponse]:
    return [WordResponse.from_word(w) for w in list_deleted_words_in_trash(db)]


@router.get("/topics", response_model=list[TopicResponse])
def list_deleted_topics(db: Session = Depends(get_db)) -> list[TopicResponse]:
    return [TopicResponse.model_validate(topic) for topic in list_deleted_topics_in_trash(db)]


@router.post("/words/{word_id}/restore", response_model=WordResponse)
def restore_word_route(word_id: int, db: Session = Depends(get_db)) -> WordResponse:
    try:
        return WordResponse.from_word(restore_word_from_trash(db, word_id))
    except DeletedWordNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted word not found")
    except RestoreWordTopicDeletedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restore word: all its topics are deleted. Restore a topic first.",
        )
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/topics/{topic_id}/restore", response_model=TopicResponse)
def restore_topic_route(topic_id: int, restore_words: bool = False, db: Session = Depends(get_db)) -> TopicResponse:
    try:
        return TopicResponse.model_validate(restore_topic_from_trash(db, topic_id, restore_words=restore_words))
    except DeletedTopicNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted topic not found")
    except InvalidTopicParentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.detail)
    except DuplicateWordInTopicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/purge", status_code=status.HTTP_204_NO_CONTENT)
def purge_expired(db: Session = Depends(get_db), force: bool = False) -> None:
    """Hard-delete trashed items. With force=true deletes all; otherwise only items older than retention days."""
    purge_trash(db, force=force)
