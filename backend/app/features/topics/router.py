from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.topics.repository import topic_repo
from app.features.topics.schemas import TopicCreate, TopicResponse, TopicUpdate
from app.features.topics.service import TopicSlugConflictError, InvalidTopicNameError, create_topic, update_topic

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicResponse])
def list_topics(db: Session = Depends(get_db)) -> list[TopicResponse]:
    return topic_repo.get_all(db)


@router.get("/{topic_id}", response_model=TopicResponse)
def get_topic(topic_id: int, db: Session = Depends(get_db)) -> TopicResponse:
    topic = topic_repo.get_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic


@router.post("", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
def create_topic_route(payload: TopicCreate, db: Session = Depends(get_db)) -> TopicResponse:
    try:
        return create_topic(db, payload)
    except InvalidTopicNameError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except TopicSlugConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)


@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic_route(topic_id: int, payload: TopicUpdate, db: Session = Depends(get_db)) -> TopicResponse:
    topic = topic_repo.get_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    try:
        return update_topic(db, topic, payload)
    except TopicSlugConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: int, delete_words: bool = False, db: Session = Depends(get_db)) -> None:
    topic = topic_repo.get_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    topic_repo.soft_delete(db, topic, delete_words=delete_words)
