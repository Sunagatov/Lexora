from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.smart_review import StudyQueueResponse
from app.services.smart_review import get_or_create_active_queue

router = APIRouter(prefix="/api/smart-review", tags=["smart-review"])


@router.get("", response_model=StudyQueueResponse)
def get_active_queue(db: Session = Depends(get_db)) -> StudyQueueResponse:
    queue = get_or_create_active_queue(db)
    if queue is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Smart Review is disabled")
    return queue


@router.post("/items/{item_id}/complete", response_model=StudyQueueResponse)
def complete_item(item_id: int, db: Session = Depends(get_db)) -> StudyQueueResponse:
    from sqlalchemy import select
    from app.models.smart_review import StudyQueue, StudyQueueItem

    item = db.get(StudyQueueItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found")

    queue = db.get(StudyQueue, item.queue_id)
    if queue is None or not queue.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue not found or inactive")

    if not item.is_completed:
        item.is_completed = True
        item.completed_at = datetime.now(timezone.utc)
        queue.completed_count += 1
        db.commit()
        db.refresh(queue)

    return queue
