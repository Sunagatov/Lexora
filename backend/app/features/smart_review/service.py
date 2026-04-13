from __future__ import annotations

import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.shared.config import settings
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.words.model import Word


def _cooldown_word_ids(db: Session) -> set[int]:
    if settings.smart_review_cooldown_days <= 0:
        return set()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.smart_review_cooldown_days)
    stmt = (
        select(StudyQueueItem.word_id)
        .join(StudyQueue, StudyQueueItem.queue_id == StudyQueue.id)
        .where(StudyQueue.generated_at >= cutoff)
    )
    return set(db.scalars(stmt).all())


def _pick_for_level(
    db: Session,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
) -> list[Word]:
    if needed <= 0:
        return []
    stmt = (
        select(Word)
        .options(selectinload(Word.topics))
        .where(Word.is_active == True)  # noqa: E712
        .where(Word.deleted_at.is_(None))
        .where(Word.knowledge_level == level)
        .order_by(Word.updated_at.asc())
    )
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))

    candidates = list(db.scalars(stmt).all())
    random.shuffle(candidates)

    picked: list[Word] = []
    for word in candidates:
        if len(picked) >= needed:
            break
        # use the smallest topic id as a deterministic primary-topic key for cap tracking
        first_topic_id = min((t.id for t in word.topics), default=0)
        if topic_counts[first_topic_id] >= settings.smart_review_max_per_topic:
            continue
        picked.append(word)
        topic_counts[first_topic_id] += 1
    return picked


def _pick_for_level_retry_excluded(
    db: Session,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
) -> list[Word]:
    """Pick words for a level; if short, retry once with already-picked ids also excluded."""
    picked = _pick_for_level(db, level, needed, excluded_ids, topic_counts)
    shortfall = needed - len(picked)
    if shortfall > 0:
        picked += _pick_for_level(db, level, shortfall, excluded_ids | {w.id for w in picked}, topic_counts)
    return picked


class QueueItemNotFoundError(Exception):
    pass


class QueueNotActiveError(Exception):
    pass


def complete_queue_item(db: Session, item_id: int) -> StudyQueue:
    """Mark a queue item complete and return the updated queue. Raises domain errors if not found/inactive."""
    item = db.get(StudyQueueItem, item_id)
    if item is None:
        raise QueueItemNotFoundError
    queue = db.get(StudyQueue, item.queue_id)
    if queue is None or not queue.is_active:
        raise QueueNotActiveError
    if not item.is_completed:
        item.is_completed = True
        item.completed_at = datetime.now(timezone.utc)
        queue.completed_count += 1
        db.commit()
    return queue


def deactivate_all_queues(db: Session) -> None:
    for q in db.scalars(select(StudyQueue).where(StudyQueue.is_active == True)).all():  # noqa: E712
        q.is_active = False
    db.commit()


def generate_queue(db: Session) -> StudyQueue:
    cooldown_ids   = _cooldown_word_ids(db)
    topic_counts: dict[int, int] = defaultdict(int)
    level_buckets  = {
        1: settings.smart_review_level_1_count,
        2: settings.smart_review_level_2_count,
        3: settings.smart_review_level_3_count,
        4: settings.smart_review_level_4_count,
        5: settings.smart_review_level_5_count,
    }

    selected: list[Word] = []
    for level, needed in level_buckets.items():
        if needed <= 0:
            continue
        words = _pick_for_level_retry_excluded(db, level, needed, cooldown_ids | {w.id for w in selected}, topic_counts)
        selected.extend(words)

    random.shuffle(selected)

    deactivate_all_queues(db)

    now = datetime.now(timezone.utc)
    queue = StudyQueue(
        generated_at=now,
        expires_at=now + timedelta(hours=settings.smart_review_queue_ttl_hours),
        is_active=True,
        total_count=len(selected),
        completed_count=0,
    )
    db.add(queue)
    db.flush()

    for position, word in enumerate(selected):
        db.add(StudyQueueItem(queue_id=queue.id, word_id=word.id, position=position, is_completed=False, completed_at=None))

    db.commit()
    db.refresh(queue)
    return queue


def get_or_create_active_queue(db: Session) -> StudyQueue | None:
    if not settings.smart_review_enabled:
        return None
    now = datetime.now(timezone.utc)
    # Return existing active queue if not expired
    queue = db.scalar(
        select(StudyQueue)
        .where(StudyQueue.is_active == True)  # noqa: E712
        .where(StudyQueue.expires_at > now)
    )
    if queue is not None:
        # Only regenerate if fully completed
        if queue.completed_count >= queue.total_count and queue.total_count > 0:
            return generate_queue(db)
        return queue
    return generate_queue(db)
