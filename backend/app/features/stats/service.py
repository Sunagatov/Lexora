from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.model import Word, word_topics
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count
from app.features.stats.model import AppUsageEvent, WordProgressEvent
from app.features.stats.schemas import (
    DailyActivity, LevelCounts, StatsResponse, TopicStat, UsageDay, UsageEventCreate,
    UsageSummary, VocabularyOverview,
)


def record_level_change(
    db: Session,
    word_id: int,
    old_level: int | None,
    new_level: int,
    source: str,
) -> None:
    """Append a progress event. Does not commit — caller owns the transaction."""
    db.add(WordProgressEvent(word_id=word_id, old_level=old_level, new_level=new_level, source=source))


def record_usage_event(db: Session, payload: UsageEventCreate) -> None:
    existing = db.scalar(select(AppUsageEvent).where(AppUsageEvent.event_key == payload.event_key))
    if existing is not None:
        return

    db.add(
        AppUsageEvent(
            event_key=payload.event_key,
            session_key=payload.session_key,
            route=payload.route,
            active_seconds=payload.active_seconds,
        )
    )


def _build_overview(words: list) -> tuple[VocabularyOverview, dict, int]:
    total        = len(words)
    example_counts = [example_count(w) for w in words]
    with_example = sum(1 for count in example_counts if count > 0)
    with_examples_3plus = sum(1 for count in example_counts if count >= EXAMPLE_TARGET_COUNT)
    with_pos     = sum(1 for w in words if w.part_of_speech)

    level_counts: dict[int | None, int] = defaultdict(int)
    for w in words:
        level_counts[w.knowledge_level] += 1

    active_total = sum(level_counts[level] for level in (1, 2, 3, 4))
    okay_pct = (
        round(((level_counts[3] + level_counts[4]) / active_total) * 100)
        if active_total > 0 else 0
    )

    overview = VocabularyOverview(
        total_words=total,
        total_topics=0,  # filled by caller
        with_example=with_example,
        with_examples_3plus=with_examples_3plus,
        with_pos=with_pos,
        missing_example=total - with_example,
        needs_example_enrichment=total - with_examples_3plus,
        missing_pos=total - with_pos,
        needs_enrichment=sum(1 for w in words if not w.example or not w.part_of_speech),
    )
    return overview, level_counts, okay_pct


def _build_topic_stats(db: Session, topics: list, word_map: dict) -> list[TopicStat]:
    rows = db.execute(select(word_topics.c.topic_id, word_topics.c.word_id)).all()
    topic_word_ids: dict[int, list[int]] = defaultdict(list)
    for topic_id, word_id in rows:
        if word_id in word_map:
            topic_word_ids[topic_id].append(word_id)

    result: list[TopicStat] = []
    for t in topics:
        tw = [word_map[wid] for wid in topic_word_ids.get(t.id, [])]
        if not tw:
            continue
        score_sum, active_count, weak_count, strong_count = 0.0, 0, 0, 0
        for w in tw:
            lvl = w.knowledge_level
            if lvl and 1 <= lvl <= 4:
                score_sum += (lvl - 1) / 3
                active_count += 1
                if lvl <= 2:
                    weak_count += 1
                else:
                    strong_count += 1
        progress = round((score_sum / active_count) * 100) if active_count > 0 else 0
        result.append(TopicStat(
            id=t.id, name=t.name, slug=t.slug, total=len(tw),
            progress=progress, weak_count=weak_count, strong_count=strong_count,
            missing_example=sum(1 for w in tw if not w.example),
            needs_example_enrichment=sum(1 for w in tw if example_count(w) < EXAMPLE_TARGET_COUNT),
            missing_pos=sum(1 for w in tw if not w.part_of_speech),
        ))
    result.sort(key=lambda t: t.progress)
    return result


def _build_words_added_by_month(words: list) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for w in words:
        key = f"{w.created_at.year}-{w.created_at.month:02d}"
        counts[key] += 1
    return dict(sorted(counts.items()))


def _build_usage_stats(db: Session) -> tuple[UsageSummary, list[UsageDay], str | None]:
    events = db.scalars(select(AppUsageEvent).order_by(AppUsageEvent.created_at.asc())).all()
    if not events:
        return (
            UsageSummary(
                total_active_seconds=0,
                active_days=0,
                sessions=0,
                avg_session_seconds=0,
                longest_session_seconds=0,
                today_active_seconds=0,
                last_7d_active_seconds=0,
            ),
            [],
            None,
        )

    daily_seconds: dict[str, int] = defaultdict(int)
    per_session_seconds: dict[str, int] = defaultdict(int)
    today = datetime.now(timezone.utc).date()
    last_7d_cutoff = today - timedelta(days=6)

    for event in events:
        day = event.created_at.date().isoformat()
        daily_seconds[day] += event.active_seconds
        per_session_seconds[event.session_key] += event.active_seconds

    total_active_seconds = sum(daily_seconds.values())
    active_days = len(daily_seconds)
    sessions = len(per_session_seconds)
    longest_session_seconds = max(per_session_seconds.values(), default=0)
    avg_session_seconds = round(total_active_seconds / sessions) if sessions > 0 else 0
    today_active_seconds = daily_seconds.get(today.isoformat(), 0)
    last_7d_active_seconds = sum(
        seconds for day, seconds in daily_seconds.items()
        if last_7d_cutoff.isoformat() <= day <= today.isoformat()
    )

    usage_daily = [
        UsageDay(date=day, active_seconds=seconds)
        for day, seconds in sorted(daily_seconds.items(), reverse=True)
    ]
    usage_started_at = min(daily_seconds.keys()) if daily_seconds else None

    return (
        UsageSummary(
            total_active_seconds=total_active_seconds,
            active_days=active_days,
            sessions=sessions,
            avg_session_seconds=avg_session_seconds,
            longest_session_seconds=longest_session_seconds,
            today_active_seconds=today_active_seconds,
            last_7d_active_seconds=last_7d_active_seconds,
        ),
        usage_daily,
        usage_started_at,
    )


def _build_daily_activity(db: Session) -> tuple[list[DailyActivity], str | None]:
    events = db.scalars(
        select(WordProgressEvent).order_by(WordProgressEvent.created_at.asc())
    ).all()

    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"reviewed": 0, "improved": 0, "downgraded": 0})
    seen_per_day: dict[str, set[int]] = defaultdict(set)
    for e in events:
        day = e.created_at.strftime("%Y-%m-%d")
        if e.word_id not in seen_per_day[day]:
            daily[day]["reviewed"] += 1
            seen_per_day[day].add(e.word_id)
        old = e.old_level or 0
        if e.new_level > old:
            daily[day]["improved"] += 1
        elif e.new_level < old:
            daily[day]["downgraded"] += 1

    activity = [
        DailyActivity(
            date=day,
            reviewed=v["reviewed"],
            improved=v["improved"],
            downgraded=v["downgraded"],
            net=v["improved"] - v["downgraded"],
        )
        for day, v in sorted(daily.items(), reverse=True)
    ]
    tracking_started_at = min(daily.keys()) if daily else None
    return activity, tracking_started_at


def compute_stats(db: Session) -> StatsResponse:
    words = cast(list[Word], db.scalars(
        select(Word).options(selectinload(Word.example_items)).where(Word.deleted_at.is_(None))
    ).all())
    topics = cast(list[Topic], db.scalars(select(Topic).where(Topic.deleted_at.is_(None))).all())

    overview, level_counts, okay_pct = _build_overview(words)
    overview = overview.model_copy(update={"total_topics": len(topics)})

    word_map     = {w.id: w for w in words}
    topic_stats  = _build_topic_stats(db, topics, word_map)
    words_by_month = _build_words_added_by_month(words)
    usage_summary, usage_daily, usage_started_at = _build_usage_stats(db)
    daily_activity, tracking_started_at = _build_daily_activity(db)

    return StatsResponse(
        overview=overview,
        level_counts=LevelCounts(
            unset=level_counts[None],
            level_1=level_counts[1],
            level_2=level_counts[2],
            level_3=level_counts[3],
            level_4=level_counts[4],
            level_5=level_counts[5],
        ),
        okay_or_better_pct=okay_pct,
        usage_summary=usage_summary,
        usage_daily=usage_daily,
        topics=topic_stats,
        daily_activity=daily_activity,
        words_added_by_month=words_by_month,
        tracking_started_at=tracking_started_at,
        usage_started_at=usage_started_at,
    )
