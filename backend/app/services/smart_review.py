from __future__ import annotations

import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.smart_review import StudyQueue, StudyQueueItem
from app.models.word import Word


def _cooldown_word_ids(db: Session) -> set[int]:
    """Return word IDs that appeared in any queue within the cooldown window."""
    if settings.smart_review_cooldown_days <= 0:
        return set()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.smart_review_cooldown_days)
    stmt = (
        select(StudyQueueItem.word_id)
        .join(StudyQueue, StudyQueueItem.queue_id == StudyQueue.id)
        .where(StudyQueue.generated_at >= cutoff)
    )
    return set(db.scalars(stmt).all())


def _level_bucket_sizes() -> dict[int, int]:
    return {
        1: settings.smart_review_level_1_count,
        2: settings.smart_review_level_2_count,
        3: settings.smart_review_level_3_count,
        4: settings.smart_review_level_4_count,
        5: settings.smart_review_level_5_count,
    }


def _pick_for_level(
    db: Session,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
) -> list[Word]:
    """Pick up to `needed` words for a given level, respecting topic cap and exclusions."""
    if needed <= 0:
        return []

    stmt = (
        select(Word)
        .where(Word.is_active == True)  # noqa: E712
        .where(Word.knowledge_level == level)
        .order_by(Word.updated_at.asc())  # least recently updated = highest priority
    )
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))

    candidates = list(db.scalars(stmt).all())
    random.shuffle(candidates)

    picked: list[Word] = []
    for word in candidates:
        if len(picked) >= needed:
            break
        if topic_counts[word.topic_id] >= settings.smart_review_max_per_topic:
            continue
        picked.append(word)
        topic_counts[word.topic_id] += 1

    return picked


def _pick_for_level_with_fallback(
    db: Session,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
) -> list[Word]:
    """Try strict cooldown first; if bucket underfills, relax cooldown for the remainder."""
    picked = _pick_for_level(db, level, needed, excluded_ids, topic_counts)

    shortfall = needed - len(picked)
    if shortfall > 0:
        already_picked_ids = {w.id for w in picked}
        picked += _pick_for_level(db, level, shortfall, already_picked_ids, topic_counts)

    return picked


def generate_queue(db: Session) -> StudyQueue:
    """Generate a new Smart Review queue and persist it. Deactivates any previous active queue."""
    cooldown_ids = _cooldown_word_ids(db)
    topic_counts: dict[int, int] = defaultdict(int)

    selected: list[Word] = []
    for level, needed in _level_bucket_sizes().items():
        if needed <= 0:
            continue
        already_selected_ids = cooldown_ids | {w.id for w in selected}
        words = _pick_for_level_with_fallback(db, level, needed, already_selected_ids, topic_counts)
        selected.extend(words)

    random.shuffle(selected)

    for q in db.scalars(select(StudyQueue).where(StudyQueue.is_active == True)).all():  # noqa: E712
        q.is_active = False

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
        db.add(StudyQueueItem(
            queue_id=queue.id,
            word_id=word.id,
            position=position,
            is_completed=False,
            completed_at=None,
        ))

    db.commit()
    db.refresh(queue)
    return queue


def get_or_create_active_queue(db: Session) -> StudyQueue | None:
    """Return the current active queue if not expired, otherwise generate a new one."""
    if not settings.smart_review_enabled:
        return None

    now = datetime.now(timezone.utc)
    queue = db.scalar(
        select(StudyQueue)
        .where(StudyQueue.is_active == True)  # noqa: E712
        .where(StudyQueue.expires_at > now)
    )
    if queue is not None:
        return queue

    return generate_queue(db)
