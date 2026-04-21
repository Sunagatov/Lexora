from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.smart_review.model import StudyQueue
from app.features.stats.model import AppUsageEvent, WordProgressEvent
from app.features.stats.schemas import (
    ConsistencySummary,
    DailyActivity,
    EfficiencySummary,
    QueueSummary,
    RetentionSummary,
    TopicStat,
    UsageDay,
    UsageSummary,
    VocabularyOverview,
)
from app.features.topics.model import Topic
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count
from app.features.words.model import Word, word_topics


def _build_overview(words: list[Word]) -> tuple[VocabularyOverview, dict[int | None, int], int]:
    total = len(words)
    example_counts = [example_count(w) for w in words]
    with_example = sum(1 for count in example_counts if count > 0)
    with_examples_3plus = sum(1 for count in example_counts if count >= EXAMPLE_TARGET_COUNT)
    with_pos = sum(1 for w in words if w.part_of_speech)

    level_counts: dict[int | None, int] = defaultdict(int)
    for w in words:
        level_counts[w.knowledge_level] += 1

    active_total = sum(level_counts[level] for level in (1, 2, 3, 4))
    okay_pct = round(((level_counts[3] + level_counts[4]) / active_total) * 100) if active_total > 0 else 0

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


def _build_topic_stats(
    db: Session,
    topics: list[Topic],
    word_map: dict[int, Word],
    reviewed_word_ids: set[int],
    regressed_word_ids: set[int],
) -> list[TopicStat]:
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
        reviewed_count = sum(1 for wid in topic_word_ids.get(t.id, []) if wid in reviewed_word_ids)
        regressed_count = sum(1 for wid in topic_word_ids.get(t.id, []) if wid in regressed_word_ids)
        result.append(
            TopicStat(
                id=t.id,
                name=t.name,
                slug=t.slug,
                total=len(tw),
                progress=progress,
                weak_count=weak_count,
                strong_count=strong_count,
                missing_example=sum(1 for w in tw if not w.example),
                needs_example_enrichment=sum(1 for w in tw if example_count(w) < EXAMPLE_TARGET_COUNT),
                missing_pos=sum(1 for w in tw if not w.part_of_speech),
                reviewed_count=reviewed_count,
                regressed_count=regressed_count,
                never_reviewed_count=max(0, len(tw) - reviewed_count),
            )
        )
    result.sort(key=lambda t: t.progress)
    return result


def _build_words_added_by_month(words: list[Word]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for w in words:
        key = f"{w.created_at.year}-{w.created_at.month:02d}"
        counts[key] += 1
    return dict(sorted(counts.items()))


def _build_usage_stats(db: Session, now: datetime | None = None) -> tuple[UsageSummary, list[UsageDay], str | None]:
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
    today = (now or datetime.now(timezone.utc)).date()
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


def _build_daily_activity(events: list[WordProgressEvent]) -> tuple[list[DailyActivity], str | None]:
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


def _build_retention_stats(
    words: list[Word],
    level_counts: dict[int | None, int],
    reviewed_word_ids: set[int],
    improved_word_ids: set[int],
    regressed_word_ids: set[int],
) -> RetentionSummary:
    active_words = sum(level_counts[level] for level in (1, 2, 3, 4))
    reviewed_words = len(reviewed_word_ids)
    improved_words = len(improved_word_ids)
    regressed_words = len(regressed_word_ids)
    total_words = len(words)
    return RetentionSummary(
        active_words=active_words,
        reviewed_words=reviewed_words,
        never_reviewed_words=max(0, total_words - reviewed_words),
        improved_words=improved_words,
        regressed_words=regressed_words,
        strong_words=level_counts[3] + level_counts[4],
        weak_words=level_counts[1] + level_counts[2],
        parked_words=level_counts[5],
        reviewed_word_share_pct=round((reviewed_words / total_words) * 100) if total_words > 0 else 0,
        improved_word_share_pct=round((improved_words / reviewed_words) * 100) if reviewed_words > 0 else 0,
        regressed_word_share_pct=round((regressed_words / reviewed_words) * 100) if reviewed_words > 0 else 0,
    )


def _build_efficiency_stats(
    usage_summary: UsageSummary,
    reviewed_word_ids: set[int],
    improved_event_count: int,
    regressed_event_count: int,
    review_event_count: int,
    improved_word_ids: set[int],
) -> EfficiencySummary:
    active_minutes = max(usage_summary.total_active_seconds / 60, 1)
    sessions = max(usage_summary.sessions, 1)
    return EfficiencySummary(
        total_review_events=review_event_count,
        reviews_per_active_minute=review_event_count / active_minutes,
        improved_events_per_active_minute=improved_event_count / active_minutes,
        net_events_per_active_minute=(improved_event_count - regressed_event_count) / active_minutes,
        reviewed_words_per_session=len(reviewed_word_ids) / sessions,
        improved_words_per_session=len(improved_word_ids) / sessions,
    )


def _longest_streak(days: set[date]) -> int:
    longest = 0
    current = 0
    previous: date | None = None
    for day in sorted(days):
        if previous is not None and (day - previous).days == 1:
            current += 1
        else:
            current = 1
        longest = max(longest, current)
        previous = day
    return longest


def _current_streak(days: set[date], today: date) -> int:
    streak = 0
    cursor = today
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _build_consistency_stats(
    usage_daily: list[UsageDay],
    daily_activity: list[DailyActivity],
    now: datetime | None = None,
) -> ConsistencySummary:
    today = (now or datetime.now(timezone.utc)).date()
    active_days = {date.fromisoformat(day.date) for day in usage_daily}
    study_days = {date.fromisoformat(day.date) for day in daily_activity}

    active_last_30 = sum(1 for day in active_days if day >= today - timedelta(days=29))
    study_last_30 = sum(1 for day in study_days if day >= today - timedelta(days=29))
    active_last_90 = sum(1 for day in active_days if day >= today - timedelta(days=89))
    study_last_90 = sum(1 for day in study_days if day >= today - timedelta(days=89))

    return ConsistencySummary(
        active_streak_days=_current_streak(active_days, today),
        study_streak_days=_current_streak(study_days, today),
        longest_active_streak_days=_longest_streak(active_days),
        longest_study_streak_days=_longest_streak(study_days),
        active_days_last_30d=active_last_30,
        study_days_last_30d=study_last_30,
        active_days_last_90d=active_last_90,
        study_days_last_90d=study_last_90,
    )


def _build_queue_stats(db: Session, now: datetime | None = None) -> QueueSummary:
    queues = db.scalars(
        select(StudyQueue).options(selectinload(StudyQueue.items)).order_by(StudyQueue.generated_at.asc())
    ).all()
    if not queues:
        return QueueSummary(
            total_queues=0,
            active_queues=0,
            completed_queues=0,
            completion_rate_pct=0,
            avg_queue_size=0,
            avg_completion_ratio_pct=0,
            avg_completion_seconds=0,
        )

    current_time = now or datetime.now(timezone.utc)
    active_queues = 0
    completed_queues = 0
    total_count = 0
    ratio_total = 0.0
    completion_durations: list[float] = []

    for queue in queues:
        total_count += queue.total_count
        if queue.is_active and queue.expires_at > current_time:
            active_queues += 1
        if queue.total_count > 0:
            ratio_total += queue.completed_count / queue.total_count
        if queue.total_count > 0 and queue.completed_count >= queue.total_count:
            completed_queues += 1
            completed_times = [item.completed_at for item in queue.items if item.completed_at is not None]
            if completed_times:
                completion_durations.append((max(completed_times) - queue.generated_at).total_seconds())

    total_queues = len(queues)
    return QueueSummary(
        total_queues=total_queues,
        active_queues=active_queues,
        completed_queues=completed_queues,
        completion_rate_pct=round((completed_queues / total_queues) * 100) if total_queues > 0 else 0,
        avg_queue_size=round(total_count / total_queues) if total_queues > 0 else 0,
        avg_completion_ratio_pct=round((ratio_total / total_queues) * 100) if total_queues > 0 else 0,
        avg_completion_seconds=round(sum(completion_durations) / len(completion_durations)) if completion_durations else 0,
    )
