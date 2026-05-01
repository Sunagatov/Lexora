from __future__ import annotations

import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.words.api import has_smart_review_candidate, list_smart_review_candidates


def cooldown_word_ids(db, *, cooldown_days: int) -> set[int]:
    if cooldown_days <= 0:
        return set()
    cutoff = datetime.now(timezone.utc) - timedelta(days=cooldown_days)
    stmt = (
        select(StudyQueueItem.word_id)
        .join(StudyQueue, StudyQueueItem.queue_id == StudyQueue.id)
        .where(StudyQueueItem.is_completed.is_(True))
        .where(StudyQueueItem.completed_at.is_not(None))
        .where(StudyQueueItem.completed_at >= cutoff)
    )
    return set(db.scalars(stmt).all())


def pick_for_level(
    db,
    *,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
    max_per_topic: int,
) -> list:
    if needed <= 0:
        return []
    candidates = list_smart_review_candidates(db, level=level, excluded_ids=excluded_ids)
    random.shuffle(candidates)

    picked: list = []
    for word in candidates:
        if len(picked) >= needed:
            break
        first_topic_id = min((topic.id for topic in word.topics), default=0)
        if topic_counts[first_topic_id] >= max_per_topic:
            continue
        picked.append(word)
        topic_counts[first_topic_id] += 1
    return picked


def pick_for_level_retry_excluded(
    db,
    *,
    level: int,
    needed: int,
    excluded_ids: set[int],
    topic_counts: dict[int, int],
    max_per_topic: int,
) -> list:
    picked = pick_for_level(
        db,
        level=level,
        needed=needed,
        excluded_ids=excluded_ids,
        topic_counts=topic_counts,
        max_per_topic=max_per_topic,
    )
    shortfall = needed - len(picked)
    if shortfall > 0:
        picked += pick_for_level(
            db,
            level=level,
            needed=shortfall,
            excluded_ids=excluded_ids | {word.id for word in picked},
            topic_counts=topic_counts,
            max_per_topic=max_per_topic,
        )
    return picked


def has_any_candidates(db, *, level_buckets: dict[int, int], excluded_ids: set[int]) -> bool:
    for level, needed in level_buckets.items():
        if needed <= 0:
            continue
        if has_smart_review_candidate(db, level=level, excluded_ids=excluded_ids):
            return True
    return False


def empty_topic_counts() -> dict[int, int]:
    return defaultdict(int)
