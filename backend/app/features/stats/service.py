from __future__ import annotations

from dataclasses import dataclass
from typing import cast

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, load_only

from app.features.stats.activity_metrics import (
    _build_consistency_stats,
    _build_daily_activity,
    _build_efficiency_stats,
    _build_queue_stats,
    _build_retention_stats,
    _build_usage_stats,
)
from app.features.stats.content_metrics import (
    list_active_word_stats,
    _build_enrichment_coverage,
    _build_overview,
    _build_topic_stats,
    _build_vocab_profile,
    _build_words_added_by_month,
)
from app.features.stats.model import AppUsageEvent
from app.features.stats.schemas import LevelCounts, StatsResponse, UsageEventCreate
from app.features.topics.model import Topic
from app.features.words.progress import WordProgressEvent


@dataclass(frozen=True)
class ProgressEventSummary:
    reviewed_word_ids: set[int]
    improved_word_ids: set[int]
    regressed_word_ids: set[int]
    improved_event_count: int
    regressed_event_count: int


def record_usage_event(db: Session, payload: UsageEventCreate) -> None:
    db.execute(
        insert(AppUsageEvent)
        .values(
            event_key=payload.event_key,
            session_key=payload.session_key,
            route=payload.route,
            active_seconds=payload.active_seconds,
        )
        .on_conflict_do_nothing(index_elements=[AppUsageEvent.event_key])
    )


def _load_active_topics(db: Session) -> list[Topic]:
    return cast(
        list[Topic],
        list(
            db.scalars(
                select(Topic)
                .options(load_only(Topic.id, Topic.name, Topic.slug))
                .where(Topic.deleted_at.is_(None))
            ).all()
        ),
    )


def _load_progress_events(db: Session) -> list[WordProgressEvent]:
    return cast(
        list[WordProgressEvent],
        list(
            db.scalars(
                select(WordProgressEvent)
                .options(
                    load_only(
                        WordProgressEvent.word_id,
                        WordProgressEvent.old_level,
                        WordProgressEvent.new_level,
                        WordProgressEvent.created_at,
                    )
                )
                .order_by(WordProgressEvent.created_at.asc())
            ).all()
        ),
    )


def _summarize_progress_events(progress_events: list[WordProgressEvent]) -> ProgressEventSummary:
    reviewed_word_ids: set[int] = set()
    improved_word_ids: set[int] = set()
    regressed_word_ids: set[int] = set()
    improved_event_count = 0
    regressed_event_count = 0

    for event in progress_events:
        reviewed_word_ids.add(event.word_id)
        old_level = event.old_level or 0
        if event.new_level > old_level:
            improved_word_ids.add(event.word_id)
            improved_event_count += 1
        elif event.new_level < old_level:
            regressed_word_ids.add(event.word_id)
            regressed_event_count += 1

    return ProgressEventSummary(
        reviewed_word_ids=reviewed_word_ids,
        improved_word_ids=improved_word_ids,
        regressed_word_ids=regressed_word_ids,
        improved_event_count=improved_event_count,
        regressed_event_count=regressed_event_count,
    )


def compute_stats(db: Session) -> StatsResponse:
    words = list_active_word_stats(db)
    topics = _load_active_topics(db)
    usage_summary, usage_daily, usage_started_at = _build_usage_stats(db)
    progress_events = _load_progress_events(db)
    progress_summary = _summarize_progress_events(progress_events)

    overview, level_counts, okay_pct = _build_overview(words)
    overview = overview.model_copy(update={"total_topics": len(topics)})
    retention_summary = _build_retention_stats(
        words,
        level_counts,
        progress_summary.reviewed_word_ids,
        progress_summary.improved_word_ids,
        progress_summary.regressed_word_ids,
    )
    efficiency_summary = _build_efficiency_stats(
        usage_summary,
        progress_summary.reviewed_word_ids,
        progress_summary.improved_event_count,
        progress_summary.regressed_event_count,
        len(progress_events),
        progress_summary.improved_word_ids,
    )

    word_map = {w.id: w for w in words}
    topic_stats = _build_topic_stats(
        db,
        topics,
        word_map,
        progress_summary.reviewed_word_ids,
        progress_summary.regressed_word_ids,
    )
    words_by_month = _build_words_added_by_month(words)
    daily_activity, tracking_started_at = _build_daily_activity(progress_events)
    consistency_summary = _build_consistency_stats(usage_daily, daily_activity)
    queue_summary = _build_queue_stats(db)

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
        vocab_profile=_build_vocab_profile(words),
        enrichment_coverage=_build_enrichment_coverage(words),
        usage_summary=usage_summary,
        retention_summary=retention_summary,
        efficiency_summary=efficiency_summary,
        consistency_summary=consistency_summary,
        queue_summary=queue_summary,
        usage_daily=usage_daily,
        topics=topic_stats,
        daily_activity=daily_activity,
        words_added_by_month=words_by_month,
        tracking_started_at=tracking_started_at,
        usage_started_at=usage_started_at,
    )
