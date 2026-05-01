from __future__ import annotations
import random
from typing import cast

from sqlalchemy.orm import Session

from app.features.smart_review import lifecycle, selection
from app.features.smart_review.exceptions import (
    QueueItemNotFoundError as QueueItemNotFoundError,
    QueueNotActiveError as QueueNotActiveError,
)
from app.features.smart_review.model import StudyQueue, StudyQueueItem as StudyQueueItem
from app.shared.config import settings
from app.shared.logging_utils import log_audit_event


def complete_queue_item(db: Session, item_id: int) -> StudyQueue:
    return lifecycle.complete_queue_item(db, item_id, log_audit_event_fn=log_audit_event)


def deactivate_all_queues(db: Session) -> None:
    lifecycle.deactivate_all_queues(db)


def generate_queue(db: Session) -> StudyQueue:
    cooldown_ids = selection.cooldown_word_ids(db, cooldown_days=settings.smart_review_cooldown_days)
    topic_counts = selection.empty_topic_counts()
    level_buckets = _level_buckets()

    selected: list = []
    for level, needed in level_buckets.items():
        if needed <= 0:
            continue
        words = selection.pick_for_level_retry_excluded(
            db,
            level=level,
            needed=needed,
            excluded_ids=cooldown_ids | {word.id for word in selected},
            topic_counts=topic_counts,
            max_per_topic=settings.smart_review_max_per_topic,
        )
        selected.extend(words)

    random.shuffle(selected)

    deactivate_all_queues(db)
    queue = lifecycle.build_queue(selected, ttl_hours=settings.smart_review_queue_ttl_hours)
    return lifecycle.persist_queue(
        db,
        queue,
        selected,
        log_audit_event_fn=log_audit_event,
        cooldown_excluded_count=len(cooldown_ids),
    )


def get_or_create_active_queue(db: Session) -> StudyQueue | None:
    if not settings.smart_review_enabled:
        return None
    queue: StudyQueue | None = cast(StudyQueue | None, lifecycle.load_active_queue(db))
    if queue is not None:
        if queue.total_count == 0:
            cooldown_ids = selection.cooldown_word_ids(db, cooldown_days=settings.smart_review_cooldown_days)
            if selection.has_any_candidates(db, level_buckets=_level_buckets(), excluded_ids=cooldown_ids):
                return generate_queue(db)
            return queue
        if lifecycle.queue_needs_regeneration(queue):
            return generate_queue(db)
        if queue.completed_count >= queue.total_count:
            return generate_queue(db)
        return queue
    return generate_queue(db)


def _level_buckets() -> dict[int, int]:
    return {
        1: settings.smart_review_level_1_count,
        2: settings.smart_review_level_2_count,
        3: settings.smart_review_level_3_count,
        4: settings.smart_review_level_4_count,
        5: settings.smart_review_level_5_count,
    }
