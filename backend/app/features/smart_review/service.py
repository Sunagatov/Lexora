from __future__ import annotations
import random
from typing import cast

from sqlalchemy.orm import Session

from app.shared.config import settings
from app.shared.logging_utils import log_audit_event
from app.features.smart_review.exceptions import (
    QueueItemNotFoundError as QueueItemNotFoundError,
    QueueNotActiveError as QueueNotActiveError,
)
from app.features.smart_review.lifecycle import (
    build_queue as _build_queue,
    complete_queue_item as _complete_queue_item,
    deactivate_all_queues as _deactivate_all_queues,
    load_active_queue as _load_active_queue,
    persist_queue as _persist_queue,
    queue_needs_regeneration as _queue_needs_regeneration_impl,
)
from app.features.smart_review.model import StudyQueue, StudyQueueItem as StudyQueueItem
from app.features.smart_review.selection import (
    cooldown_word_ids as _cooldown_word_ids_impl,
    empty_topic_counts,
    has_any_candidates as _has_any_candidates_impl,
    pick_for_level as _pick_for_level_impl,
    pick_for_level_retry_excluded as _pick_for_level_retry_excluded_impl,
)

def _cooldown_word_ids(db: Session) -> set[int]:
    return _cooldown_word_ids_impl(db, cooldown_days=settings.smart_review_cooldown_days)


def _pick_for_level(
    db: Session,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
) -> list:
    return _pick_for_level_impl(
        db,
        level=level,
        needed=needed,
        excluded_ids=excluded_ids,
        topic_counts=topic_counts,
        max_per_topic=settings.smart_review_max_per_topic,
    )


def _pick_for_level_retry_excluded(
    db: Session,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
) -> list:
    return _pick_for_level_retry_excluded_impl(
        db,
        level=level,
        needed=needed,
        excluded_ids=excluded_ids,
        topic_counts=topic_counts,
        max_per_topic=settings.smart_review_max_per_topic,
    )


def _has_any_candidates(db: Session, excluded_ids: set[int]) -> bool:
    return _has_any_candidates_impl(db, level_buckets=_level_buckets(), excluded_ids=excluded_ids)


def _queue_needs_regeneration(queue: StudyQueue) -> bool:
    return _queue_needs_regeneration_impl(queue)


def complete_queue_item(db: Session, item_id: int) -> StudyQueue:
    return _complete_queue_item(db, item_id, log_audit_event_fn=log_audit_event)


def deactivate_all_queues(db: Session) -> None:
    _deactivate_all_queues(db)


def generate_queue(db: Session) -> StudyQueue:
    cooldown_ids = _cooldown_word_ids(db)
    topic_counts = empty_topic_counts()
    level_buckets = _level_buckets()

    selected: list = []
    for level, needed in level_buckets.items():
        if needed <= 0:
            continue
        words = _pick_for_level_retry_excluded(
            db,
            level,
            needed,
            cooldown_ids | {word.id for word in selected},
            topic_counts,
        )
        selected.extend(words)

    random.shuffle(selected)

    deactivate_all_queues(db)
    queue = _build_queue(selected, ttl_hours=settings.smart_review_queue_ttl_hours)
    return _persist_queue(
        db,
        queue,
        selected,
        log_audit_event_fn=log_audit_event,
        cooldown_excluded_count=len(cooldown_ids),
    )


def get_or_create_active_queue(db: Session) -> StudyQueue | None:
    if not settings.smart_review_enabled:
        return None
    queue: StudyQueue | None = cast(StudyQueue | None, _load_active_queue(db))
    if queue is not None:
        if queue.total_count == 0:
            cooldown_ids = _cooldown_word_ids(db)
            if _has_any_candidates(db, cooldown_ids):
                return generate_queue(db)
            return queue
        if _queue_needs_regeneration(queue):
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
