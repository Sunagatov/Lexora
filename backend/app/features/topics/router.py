from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.topics.api import get_all_topics, get_topic_by_id
from app.features.topics.schemas import TopicCreate, TopicResponse, TopicSidebarStatsResponse, TopicUpdate
from app.features.topics.service import (
    delete_topic as delete_topic_service,
    InvalidTopicNameError,
    InvalidTopicParentError,
    TopicHasActiveChildrenError,
    TopicNameConflictError,
    TopicSlugConflictError,
    compute_topic_sidebar_stats,
    create_topic,
    update_topic,
)
from app.features.topics.refinement_schemas import (
    TopicAuditResponse,
    TopicSplitPlanRequest,
    TopicSplitPlanResponse,
)
from app.features.topics.refinement_service import build_topic_audit, build_topic_split_plan

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicResponse])
def list_topics(db: Session = Depends(get_db)) -> list[TopicResponse]:
    topics = get_all_topics(db)
    responses: list[TopicResponse] = [TopicResponse.model_validate(topic) for topic in topics]
    return responses


@router.get("/sidebar-stats", response_model=TopicSidebarStatsResponse)
def sidebar_stats(db: Session = Depends(get_db)) -> TopicSidebarStatsResponse:
    return compute_topic_sidebar_stats(db)


@router.get("/audit", response_model=TopicAuditResponse)
def audit_topics(db: Session = Depends(get_db)) -> TopicAuditResponse:
    return build_topic_audit(db)


@router.get("/{topic_id}", response_model=TopicResponse)
def get_topic(topic_id: int, db: Session = Depends(get_db)) -> TopicResponse:
    topic = get_topic_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    response: TopicResponse = TopicResponse.model_validate(topic)
    return response


@router.post("", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
def create_topic_route(payload: TopicCreate, db: Session = Depends(get_db)) -> TopicResponse:
    try:
        response: TopicResponse = TopicResponse.model_validate(create_topic(db, payload))
        return response
    except InvalidTopicNameError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InvalidTopicParentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.detail)
    except TopicNameConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)
    except TopicSlugConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)


@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic_route(topic_id: int, payload: TopicUpdate, db: Session = Depends(get_db)) -> TopicResponse:
    topic = get_topic_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    try:
        response: TopicResponse = TopicResponse.model_validate(update_topic(db, topic, payload))
        return response
    except InvalidTopicNameError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InvalidTopicParentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.detail)
    except TopicNameConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)
    except TopicSlugConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)


@router.post("/{topic_id}/split-plan", response_model=TopicSplitPlanResponse)
def split_topic_plan(
    topic_id: int,
    payload: TopicSplitPlanRequest,
    db: Session = Depends(get_db),
) -> TopicSplitPlanResponse:
    try:
        return build_topic_split_plan(db, topic_id, payload)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: int, delete_words: bool = False, db: Session = Depends(get_db)) -> None:
    topic = get_topic_by_id(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    try:
        delete_topic_service(db, topic, delete_words=delete_words)
    except TopicHasActiveChildrenError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)
