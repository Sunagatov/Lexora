from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.features.smart_review.exceptions import QueueItemNotFoundError, QueueNotActiveError
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.words.repository import get_word_for_queue_validation


def queue_needs_regeneration(queue: StudyQueue) -> bool:
    if len(queue.items) != queue.total_count:
        return True
    return any(
        item.word is None
        or item.word.deleted_at is not None
        or not item.word.is_active
        for item in queue.items
    )


def complete_queue_item(db, item_id: int, *, log_audit_event_fn) -> StudyQueue:
    item: StudyQueueItem | None = cast(StudyQueueItem | None, db.get(StudyQueueItem, item_id))
    if item is None:
        raise QueueItemNotFoundError

    queue: StudyQueue | None = cast(StudyQueue | None, db.get(StudyQueue, item.queue_id))
    now = datetime.now(timezone.utc)
    if queue is None or not queue.is_active or queue.expires_at <= now:
        raise QueueNotActiveError

    word = get_word_for_queue_validation(db, item.word_id)
    if word is None or word.deleted_at is not None or not word.is_active:
        raise QueueNotActiveError

    if not item.is_completed:
        item.is_completed = True
        item.completed_at = now
        queue.completed_count += 1
        db.commit()

    return queue


def deactivate_all_queues(db) -> None:
    for queue in cast(list[StudyQueue], list(db.scalars(select(StudyQueue).where(StudyQueue.is_active.is_(True))).all())):
        queue.is_active = False


def build_queue(selected_words: list, *, ttl_hours: int) -> StudyQueue:
    now = datetime.now(timezone.utc)
    return StudyQueue(
        generated_at=now,
        expires_at=now + timedelta(hours=ttl_hours),
        is_active=True,
        total_count=len(selected_words),
        completed_count=0,
    )


def persist_queue(db, queue: StudyQueue, selected_words: list, *, log_audit_event_fn, cooldown_excluded_count: int) -> StudyQueue:
    db.add(queue)
    db.flush()

    for position, word in enumerate(selected_words):
        db.add(
            StudyQueueItem(
                queue_id=queue.id,
                word_id=word.id,
                position=position,
                is_completed=False,
                completed_at=None,
            )
        )

    db.commit()
    db.refresh(queue)
    log_audit_event_fn(
        "smart_review_queue_generated",
        queue_id=queue.id,
        total_count=queue.total_count,
        expires_at=queue.expires_at.isoformat(),
        cooldown_excluded_count=cooldown_excluded_count,
    )
    return queue


def load_active_queue(db) -> StudyQueue | None:
    now = datetime.now(timezone.utc)
    return cast(
        StudyQueue | None,
        db.scalar(
            select(StudyQueue)
            .where(StudyQueue.is_active.is_(True))
            .where(StudyQueue.expires_at > now)
            .options(selectinload(StudyQueue.items).selectinload(StudyQueueItem.word))
            .order_by(StudyQueue.generated_at.desc())
        ),
    )
