from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, load_only

from app.features.languages.catalog import learning_language, translation_language
from app.features.stats.activity_metrics import (
    _build_consistency_stats,
    _build_daily_activity,
    _build_efficiency_stats,
    _build_queue_stats,
    _build_retention_stats,
    _build_usage_stats,
    _knowledge_change,
    _utc_timestamp,
    build_daily_mix_summary,
)
from app.features.stats.content_metrics import (
    _build_enrichment_coverage,
    _build_library_overview,
    _build_overview,
    _build_topic_stats,
    _build_vocab_profile,
    _build_words_added_by_month,
    build_library_topic,
    list_active_word_stats,
    load_topic_word_ids,
    okay_or_better_pct,
    roll_up_topic_words,
)
from app.features.stats.model import AppUsageEvent
from app.features.stats.schemas import (
    LearningStatsResponse,
    LearningTopicStat,
    LevelCounts,
    LibraryReadiness,
    LibraryStatsResponse,
    ReviewHistory,
    ReviewPeriod,
    StatsResponse,
    StudyCoverage,
    UsageEventCreate,
)
from app.features.topics.model import Topic
from app.features.words.constants import PROGRESS_SOURCE_SMART_REVIEW, PROGRESS_SOURCE_STUDY_LIST
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count
from app.features.words.model import Word
from app.features.words.progress import WordProgressEvent

STUDY_SOURCES = (PROGRESS_SOURCE_SMART_REVIEW, PROGRESS_SOURCE_STUDY_LIST)


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
            language=learning_language(db),
        )
        .on_conflict_do_nothing(index_elements=[AppUsageEvent.event_key])
    )


def _load_active_topics(db: Session) -> list[Topic]:
    return cast(
        list[Topic],
        list(
            db.scalars(
                select(Topic)
                .options(load_only(Topic.id, Topic.name, Topic.slug, Topic.parent_topic_id))
                .where(Topic.deleted_at.is_(None))
                .where(Topic.language == learning_language(db))
            ).all()
        ),
    )


def _load_progress_events(db: Session, *, study_only: bool = False) -> list[WordProgressEvent]:
    stmt = (
        select(WordProgressEvent)
        .join(Word, Word.id == WordProgressEvent.word_id)
        .where(Word.language == learning_language(db))
        .options(load_only(
            WordProgressEvent.word_id, WordProgressEvent.old_level,
            WordProgressEvent.new_level, WordProgressEvent.created_at,
        ))
        .order_by(WordProgressEvent.created_at, WordProgressEvent.id)
    )
    if study_only:
        stmt = stmt.where(WordProgressEvent.source.in_(STUDY_SOURCES))
    return list(db.scalars(stmt))


def _summarize_progress_events(
    progress_events: list[WordProgressEvent], *, merge_basic: bool = False
) -> ProgressEventSummary:
    reviewed_word_ids: set[int] = set()
    improved_word_ids: set[int] = set()
    regressed_word_ids: set[int] = set()
    improved_event_count = 0
    regressed_event_count = 0

    for event in progress_events:
        reviewed_word_ids.add(event.word_id)
        change = _knowledge_change(event.old_level, event.new_level, merge_basic=merge_basic)
        if change > 0:
            improved_word_ids.add(event.word_id)
            improved_event_count += 1
        elif change < 0:
            regressed_word_ids.add(event.word_id)
            regressed_event_count += 1

    return ProgressEventSummary(
        reviewed_word_ids=reviewed_word_ids,
        improved_word_ids=improved_word_ids,
        regressed_word_ids=regressed_word_ids,
        improved_event_count=improved_event_count,
        regressed_event_count=regressed_event_count,
    )


def _build_review_periods(events: list[WordProgressEvent], today: date) -> dict[str, ReviewPeriod]:
    windows = {
        str(span): (today - timedelta(days=span - 1), today)
        for span in (7, 30, 90, 365)
    }
    windows["all"] = (date.min, today)
    windows["previous_week"] = (today - timedelta(days=13), today - timedelta(days=7))
    periods = {key: ReviewPeriod() for key in windows}
    movement: dict[str, dict[int, int]] = {key: defaultdict(int) for key in windows}
    days: dict[str, set[date]] = {key: set() for key in windows}
    seen: set[int] = set()
    ranks = {None: 0, 1: 1, 2: 2, 3: 2, 4: 3}
    for event in events:
        day = _utc_timestamp(event.created_at).date()
        first_review = event.word_id not in seen
        seen.add(event.word_id)
        old_rank, new_rank = ranks.get(event.old_level), ranks.get(event.new_level)
        step = new_rank - old_rank if old_rank is not None and new_rank is not None else 0
        for key, (start, end) in windows.items():
            if start <= day <= end:
                period = periods[key]
                period.attempts += 1
                period.first_reviews += first_review
                days[key].add(day)
                # Sum only study-rating steps. Edits between reviews do not count as movement.
                movement[key][event.word_id] += step

    for key, period in periods.items():
        totals = movement[key].values()
        period.unique_words = len(totals)
        period.repeat_reviews = period.attempts - period.first_reviews
        period.improved_words = sum(1 for change in totals if change > 0)
        period.regressed_words = sum(1 for change in totals if change < 0)
        period.study_days = len(days[key])
    return periods


def compute_learning_stats(db: Session) -> LearningStatsResponse:
    language = learning_language(db)
    counts = {
        level: count
        for level, count in db.execute(
            select(Word.knowledge_level, func.count())
            .where(Word.language == language, Word.deleted_at.is_(None))
            .group_by(Word.knowledge_level)
        )
    }
    counts[3] = counts.get(3, 0) + counts.get(2, 0)
    levels = LevelCounts(
        unset=counts.get(None, 0), level_1=counts.get(1, 0), level_3=counts[3],
        level_4=counts.get(4, 0), level_5=counts.get(5, 0),
    )

    now = datetime.now(UTC)
    usage, usage_daily, usage_started = _build_usage_stats(db, now)
    events = _load_progress_events(db, study_only=True)
    summary = _summarize_progress_events(events, merge_basic=True)
    daily, tracking_started = _build_daily_activity(events, merge_basic=True)
    topics = _load_active_topics(db)
    links = load_topic_word_ids(db, summary.reviewed_word_ids)
    topic_words = roll_up_topic_words(topics, links)

    return LearningStatsResponse(
        level_counts=levels,
        okay_or_better_pct=okay_or_better_pct(counts),
        review_history=ReviewHistory(
            reviewed_words=len(summary.reviewed_word_ids),
            improved_words=len(summary.improved_word_ids),
            regressed_words=len(summary.regressed_word_ids),
        ),
        usage_summary=usage,
        consistency_summary=_build_consistency_stats(usage_daily, daily, now, allow_yesterday=True),
        mix_activity=build_daily_mix_summary(db, now),
        review_periods=_build_review_periods(events, now.date()),
        as_of=now.date().isoformat(),
        usage_daily=usage_daily,
        topics=[
            LearningTopicStat(
                id=topic.id, name=topic.name, slug=topic.slug, reviewed_count=len(word_ids),
                improved_count=len(word_ids & summary.improved_word_ids),
                regressed_count=len(word_ids & summary.regressed_word_ids),
            )
            for topic in topics if (word_ids := topic_words.get(topic.id))
        ],
        daily_activity=daily,
        tracking_started_at=tracking_started,
        usage_started_at=usage_started,
    )


def compute_library_stats(db: Session) -> LibraryStatsResponse:
    translations = translation_language(db)
    words = list_active_word_stats(db, translations=translations)
    topics = _load_active_topics(db)
    word_map = {word.id: word for word in words}
    direct_links = load_topic_word_ids(db, set(word_map))
    topic_words = roll_up_topic_words(topics, direct_links)
    topic_counts: dict[int, int] = defaultdict(int)
    for topic in topics:
        for word_id in direct_links.get(topic.id, ()):
            topic_counts[word_id] += 1
    reviewed_ids = db.scalars(
        select(WordProgressEvent.word_id)
        .join(Word, Word.id == WordProgressEvent.word_id)
        .where(
            Word.language == learning_language(db), Word.deleted_at.is_(None),
            WordProgressEvent.source.in_(STUDY_SOURCES),
        )
        .distinct()
    )
    reviewed = len(set(reviewed_ids).intersection(word_map))
    total = len(words)
    return LibraryStatsResponse(
        overview=_build_library_overview(words, total_topics=len(topics)),
        vocab_profile=_build_vocab_profile(words),
        enrichment_coverage=_build_enrichment_coverage(words),
        topics=[build_library_topic(topic, [word_map[id_] for id_ in topic_words.get(topic.id, set())]) for topic in topics],
        words_added_by_month=_build_words_added_by_month(words),
        study_coverage=StudyCoverage(
            reviewed_words=reviewed,
            never_reviewed_words=total - reviewed,
            reviewed_word_share_pct=round(reviewed / total * 100) if total else 0,
        ),
        readiness=LibraryReadiness(
            translation_language=translations,
            ready=sum(1 for word in words if word.translation_count and example_count(word)),
            missing_translation=sum(1 for word in words if not word.translation_count),
            no_examples=sum(1 for word in words if not example_count(word)),
            needs_examples=sum(1 for word in words if example_count(word) < EXAMPLE_TARGET_COUNT),
            no_topic=total - len(topic_counts),
            multiple_topics=sum(1 for count in topic_counts.values() if count > 1),
        ),
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
            level_2=0,  # Compatibility field for older clients; Basic has been retired.
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
