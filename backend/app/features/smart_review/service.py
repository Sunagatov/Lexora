from __future__ import annotations

import random
from typing import cast

from sqlalchemy.orm import Session

from app.features.languages.catalog import learning_language
from app.features.preferences.api import configured_word_mix_preferences
from app.features.smart_review import lifecycle, selection
from app.features.smart_review.exceptions import (
    QueueItemNotFoundError as QueueItemNotFoundError,  # noqa: PLC0414 - compatibility export
)
from app.features.smart_review.exceptions import (
    QueueNotActiveError as QueueNotActiveError,  # noqa: PLC0414 - compatibility export
)
from app.features.smart_review.model import StudyQueue
from app.features.smart_review.model import StudyQueueItem as StudyQueueItem  # noqa: PLC0414 - compatibility export
from app.shared.config import settings
from app.shared.logging_utils import log_audit_event
from app.shared.transaction_locks import lock_language_transaction


def complete_queue_item(db: Session, item_id: int) -> StudyQueue:
    return lifecycle.complete_queue_item(db, item_id)


def deactivate_all_queues(db: Session) -> None:
    lifecycle.deactivate_all_queues(db)


def generate_queue(db: Session) -> StudyQueue:
    lock_language_transaction(db, 71001, learning_language(db))
    preferences = configured_word_mix_preferences(db)
    cooldown_days = preferences.cooldown_days if preferences else settings.smart_review_cooldown_days
    cooldown_ids = selection.cooldown_word_ids(db, cooldown_days=cooldown_days)
    if preferences is not None:
        selected = selection.pick_configured_words(db, preferences)
    else:
        topic_counts = selection.empty_topic_counts()
        selected = []
        for level, needed in _level_buckets().items():
            if needed <= 0:
                continue
            words = selection.pick_for_level_retry_excluded(
                db, level=level, needed=needed,
                excluded_ids=cooldown_ids | {word.id for word in selected},
                topic_counts=topic_counts, max_per_topic=settings.smart_review_max_per_topic,
                cefr_weights=settings.smart_review_cefr_weights,
            )
            selected.extend(words)

    random.shuffle(selected)

    deactivate_all_queues(db)
    queue = lifecycle.build_queue(selected, ttl_hours=settings.smart_review_queue_ttl_hours)
    queue.language = learning_language(db)
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
    lock_language_transaction(db, 71001, learning_language(db))
    queue: StudyQueue | None = cast(StudyQueue | None, lifecycle.load_active_queue_lightweight(db))
    if queue is not None:
        if _should_regenerate_queue(db, queue):
            return generate_queue(db)
        return queue
    return generate_queue(db)


def _level_buckets() -> dict[int, int]:
    return {
        1: settings.smart_review_level_1_count,
        # Preserve the total review quota when merging the two former buckets.
        3: settings.smart_review_level_2_count + settings.smart_review_level_3_count,
        4: settings.smart_review_level_4_count,
        5: settings.smart_review_level_5_count,
    }


def _should_regenerate_queue(db: Session, queue: StudyQueue) -> bool:
    if queue.total_count == 0:
        preferences = configured_word_mix_preferences(db)
        if preferences is not None:
            return selection.has_configured_candidates(db, preferences)
        cooldown_ids = selection.cooldown_word_ids(db, cooldown_days=settings.smart_review_cooldown_days)
        return selection.has_any_candidates(db, level_buckets=_level_buckets(), excluded_ids=cooldown_ids)
    if lifecycle.queue_needs_regeneration_sql(db, queue.id, queue.total_count):
        return True
    return queue.completed_count >= queue.total_count
