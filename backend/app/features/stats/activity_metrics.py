from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.smart_review.model import StudyQueue
from app.features.stats.model import AppUsageEvent
from app.features.stats.schemas import (
    ConsistencySummary,
    DailyActivity,
    EfficiencySummary,
    QueueSummary,
    RetentionSummary,
    UsageDay,
    UsageSummary,
)
from app.features.words.progress import WordProgressEvent
from app.features.words.repository import WordStatsSnapshot


def _build_daily_activity(events: list[WordProgressEvent]) -> tuple[list[DailyActivity], str | None]:
    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"reviewed": 0, "improved": 0, "downgraded": 0})
    seen_per_day: dict[str, set[int]] = defaultdict(set)
    for event in events:
        day = event.created_at.strftime("%Y-%m-%d")
        if event.word_id not in seen_per_day[day]:
            daily[day]["reviewed"] += 1
            seen_per_day[day].add(event.word_id)

        old_level = event.old_level or 0
        if event.new_level > old_level:
            daily[day]["improved"] += 1
        elif event.new_level < old_level:
            daily[day]["downgraded"] += 1

    activity = [
        DailyActivity(
            date=day,
            reviewed=values["reviewed"],
            improved=values["improved"],
            downgraded=values["downgraded"],
            net=values["improved"] - values["downgraded"],
        )
        for day, values in sorted(daily.items(), reverse=True)
    ]
    return activity, min(daily.keys()) if daily else None


def _build_retention_stats(
    words: list[WordStatsSnapshot],
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


def _build_consistency_stats(
    usage_daily: list[UsageDay],
    daily_activity: list[DailyActivity],
    now: datetime | None = None,
) -> ConsistencySummary:
    today = (now or datetime.now(timezone.utc)).date()
    active_days = {date.fromisoformat(day.date) for day in usage_daily}
    study_days = {date.fromisoformat(day.date) for day in daily_activity}

    return ConsistencySummary(
        active_streak_days=_current_streak(active_days, today),
        study_streak_days=_current_streak(study_days, today),
        longest_active_streak_days=_longest_streak(active_days),
        longest_study_streak_days=_longest_streak(study_days),
        active_days_last_30d=_count_recent_days(active_days, today, 30),
        study_days_last_30d=_count_recent_days(study_days, today, 30),
        active_days_last_90d=_count_recent_days(active_days, today, 90),
        study_days_last_90d=_count_recent_days(study_days, today, 90),
    )


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

    daily_seconds, per_session_seconds = _collect_usage_totals(events)
    today = (now or datetime.now(timezone.utc)).date()
    last_7d_cutoff = today - timedelta(days=6)
    total_active_seconds = sum(daily_seconds.values())
    sessions = len(per_session_seconds)

    usage_daily = [
        UsageDay(date=day, active_seconds=seconds)
        for day, seconds in sorted(daily_seconds.items(), reverse=True)
    ]
    summary = UsageSummary(
        total_active_seconds=total_active_seconds,
        active_days=len(daily_seconds),
        sessions=sessions,
        avg_session_seconds=round(total_active_seconds / sessions) if sessions > 0 else 0,
        longest_session_seconds=max(per_session_seconds.values(), default=0),
        today_active_seconds=daily_seconds.get(today.isoformat(), 0),
        last_7d_active_seconds=sum(
            seconds
            for day, seconds in daily_seconds.items()
            if last_7d_cutoff.isoformat() <= day <= today.isoformat()
        ),
    )
    return summary, usage_daily, min(daily_seconds.keys())


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
        avg_completion_seconds=round(sum(completion_durations) / len(completion_durations))
        if completion_durations
        else 0,
    )


def _current_streak(days: set[date], today: date) -> int:
    streak = 0
    cursor = today
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


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


def _count_recent_days(days: set[date], today: date, span_days: int) -> int:
    cutoff = today - timedelta(days=span_days - 1)
    return sum(1 for day in days if day >= cutoff)


def _collect_usage_totals(events: list[AppUsageEvent]) -> tuple[dict[str, int], dict[str, int]]:
    daily_seconds: dict[str, int] = defaultdict(int)
    per_session_seconds: dict[str, int] = defaultdict(int)
    for event in events:
        day = event.created_at.date().isoformat()
        daily_seconds[day] += event.active_seconds
        per_session_seconds[event.session_key] += event.active_seconds
    return daily_seconds, per_session_seconds
