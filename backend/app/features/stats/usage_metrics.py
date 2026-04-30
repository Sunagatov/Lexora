from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.stats.model import AppUsageEvent
from app.features.stats.schemas import UsageDay, UsageSummary


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


def _collect_usage_totals(
    events: list[AppUsageEvent],
) -> tuple[dict[str, int], dict[str, int]]:
    daily_seconds: dict[str, int] = defaultdict(int)
    per_session_seconds: dict[str, int] = defaultdict(int)
    for event in events:
        day = event.created_at.date().isoformat()
        daily_seconds[day] += event.active_seconds
        per_session_seconds[event.session_key] += event.active_seconds
    return daily_seconds, per_session_seconds
