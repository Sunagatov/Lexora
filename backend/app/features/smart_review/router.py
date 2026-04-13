from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.shared.deps import get_db
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.smart_review.schemas import StudyQueueResponse
from app.features.smart_review.service import (
    get_or_create_active_queue, generate_queue, deactivate_all_queues,
    complete_queue_item, QueueItemNotFoundError, QueueNotActiveError,
)
from app.features.words.model import Word

router = APIRouter(prefix="/api/smart-review", tags=["smart-review"])


def _load_queue(db: Session, queue_id: int) -> StudyQueue | None:
    return db.scalar(
        select(StudyQueue)
        .where(StudyQueue.id == queue_id)
        .options(
            selectinload(StudyQueue.items).selectinload(StudyQueueItem.word).selectinload(Word.topics)
        )
    )


@router.get("", response_model=StudyQueueResponse)
def get_active_queue(db: Session = Depends(get_db)) -> StudyQueueResponse:
    queue = get_or_create_active_queue(db)
    if queue is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Smart Review is disabled")
    loaded = _load_queue(db, queue.id)
    return StudyQueueResponse.from_queue(loaded)


@router.post("/refresh", response_model=StudyQueueResponse)
def refresh_queue(db: Session = Depends(get_db)) -> StudyQueueResponse:
    """Discard the current queue and generate a fresh one."""
    deactivate_all_queues(db)
    queue = generate_queue(db)
    loaded = _load_queue(db, queue.id)
    return StudyQueueResponse.from_queue(loaded)


@router.post("/items/{item_id}/complete", response_model=StudyQueueResponse)
def complete_item(item_id: int, db: Session = Depends(get_db)) -> StudyQueueResponse:
    try:
        queue = complete_queue_item(db, item_id)
    except QueueItemNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found")
    except QueueNotActiveError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue not found or inactive")
    loaded = _load_queue(db, queue.id)
    return StudyQueueResponse.from_queue(loaded)
