from __future__ import annotations

import random
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.features.languages.catalog import learning_language
from app.features.preferences.schemas import WordMixPreferences
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.words.model import Word


def configured_candidates_stmt(db, preferences: WordMixPreferences):
    levels = [*preferences.levels, *([2] if 3 in preferences.levels else [])]
    stmt = select(Word).where(
        Word.language == learning_language(db), Word.is_active.is_(True),
        Word.deleted_at.is_(None), Word.knowledge_level.in_(levels),
    )
    if preferences.cefr_levels:
        stmt = stmt.where(Word.cefr_level.in_(preferences.cefr_levels))
    excluded = cooldown_word_ids(db, cooldown_days=preferences.cooldown_days)
    if excluded:
        stmt = stmt.where(Word.id.not_in(excluded))
    return stmt


def pick_configured_words(db, preferences: WordMixPreferences) -> list[Word]:
    from sqlalchemy.sql.expression import func as sa_func
    stmt = configured_candidates_stmt(db, preferences).options(selectinload(Word.topics)).order_by(sa_func.random())
    if not preferences.balance_topics:
        return list(db.scalars(stmt.limit(preferences.size)).all())
    # Round-robin topic buckets are a soft balance, so a small library can still fill a set.
    buckets = defaultdict(deque)
    for word in db.scalars(stmt).all():
        buckets[min((topic.id for topic in word.topics), default=0)].append(word)
    selected = []
    while buckets and len(selected) < preferences.size:
        for topic_id in list(buckets):
            selected.append(buckets[topic_id].popleft())
            if not buckets[topic_id]:
                del buckets[topic_id]
            if len(selected) == preferences.size:
                break
    return selected


def has_configured_candidates(db, preferences: WordMixPreferences) -> bool:
    return db.scalar(configured_candidates_stmt(db, preferences).with_only_columns(Word.id).limit(1)) is not None


def cooldown_word_ids(db, *, cooldown_days: int) -> set[int]:
    if cooldown_days <= 0:
        return set()
    cutoff = datetime.now(UTC) - timedelta(days=cooldown_days)
    stmt = (
        select(StudyQueueItem.word_id)
        .join(StudyQueue, StudyQueueItem.queue_id == StudyQueue.id)
        .where(StudyQueue.language == learning_language(db))
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
    cefr_weights: dict[str, int] | None = None,
) -> list:
    if needed <= 0:
        return []
    candidates = _list_smart_review_candidates(db, level=level, excluded_ids=excluded_ids, needed=needed)
    random.shuffle(candidates)

    if cefr_weights:
        # Sort candidates so higher-weighted CEFR levels come first (soft preference)
        def cefr_priority(word):
            return -(cefr_weights.get(word.cefr_level or "", 0))
        candidates.sort(key=cefr_priority)

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
    cefr_weights: dict[str, int] | None = None,
) -> list:
    picked = pick_for_level(
        db,
        level=level,
        needed=needed,
        excluded_ids=excluded_ids,
        topic_counts=topic_counts,
        max_per_topic=max_per_topic,
        cefr_weights=cefr_weights,
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
            cefr_weights=cefr_weights,
        )
    return picked


def has_any_candidates(db, *, level_buckets: dict[int, int], excluded_ids: set[int]) -> bool:
    for level, needed in level_buckets.items():
        if needed <= 0:
            continue
        if _has_smart_review_candidate(db, level=level, excluded_ids=excluded_ids):
            return True
    return False


def empty_topic_counts() -> dict[int, int]:
    return defaultdict(int)


def _list_smart_review_candidates(db, *, level: int, excluded_ids: set[int], needed: int = 50) -> list[Word]:
    from sqlalchemy.sql.expression import func as sa_func
    stmt = (
        select(Word)
        .where(Word.language == learning_language(db))
        .options(selectinload(Word.topics))
        .where(Word.is_active.is_(True))
        .where(Word.deleted_at.is_(None))
        .order_by(sa_func.random())
        .limit(needed * 5)
    )
    stmt = stmt.where(Word.knowledge_level == level)
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))
    return list(db.scalars(stmt).all())


def _has_smart_review_candidate(db, *, level: int, excluded_ids: set[int]) -> bool:
    stmt = (
        select(Word.id)
        .where(Word.language == learning_language(db))
        .where(Word.is_active.is_(True))
        .where(Word.deleted_at.is_(None))
        .limit(1)
    )
    stmt = stmt.where(Word.knowledge_level == level)
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))
    return db.scalar(stmt) is not None
