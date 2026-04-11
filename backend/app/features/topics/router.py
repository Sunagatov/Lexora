from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.topics.model import Topic
from app.features.topics.repository import topic_repo
from app.features.topics.schemas import TopicCreate, TopicResponse, TopicUpdate

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
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)) -> TopicResponse:
    # Check slug against ALL topics including soft-deleted to avoid DB unique constraint crash
    existing = db.scalar(select(Topic).where(Topic.slug == payload.slug))
    if existing is not None:
        detail = (
            f"Topic slug '{payload.slug}' already exists"
            if existing.deleted_at is None
            else f"Topic slug '{payload.slug}' is used by a deleted topic — restore or permanently delete it first"
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    return topic_repo.create(db, payload)


@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic(topic_id: int, payload: TopicUpdate, db: Session = Depends(get_db)) -> TopicResponse:
    topic = topic_repo.get_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    if payload.slug and payload.slug != topic.slug and topic_repo.get_by_slug(db, payload.slug) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Topic slug already exists")
    return topic_repo.update(db, topic, payload)


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: int, delete_words: bool = False, db: Session = Depends(get_db)) -> None:
    topic = topic_repo.get_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    topic_repo.soft_delete(db, topic, delete_words=delete_words)
