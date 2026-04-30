from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.smart_review.model import StudyQueue
from app.features.stats.schemas import QueueSummary


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
