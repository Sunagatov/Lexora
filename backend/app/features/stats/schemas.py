from __future__ import annotations

from pydantic import BaseModel
from pydantic import Field


class LevelCounts(BaseModel):
    unset: int
    level_1: int
    level_2: int
    level_3: int
    level_4: int
    level_5: int


class TopicStat(BaseModel):
    id: int
    name: str
    slug: str
    total: int
    progress: int        # 0-100 weighted score
    weak_count: int      # levels 1-2
    strong_count: int    # levels 3-4
    missing_example: int
    needs_example_enrichment: int
    missing_pos: int
    reviewed_count: int
    regressed_count: int
    never_reviewed_count: int


class DailyActivity(BaseModel):
    date: str            # YYYY-MM-DD
    reviewed: int        # distinct words whose level changed
    improved: int        # level went up
    downgraded: int      # level went down
    net: int             # improved - downgraded


class UsageDay(BaseModel):
    date: str            # YYYY-MM-DD
    active_seconds: int


class UsageSummary(BaseModel):
    total_active_seconds: int
    active_days: int
    sessions: int
    avg_session_seconds: int
    longest_session_seconds: int
    today_active_seconds: int
    last_7d_active_seconds: int


class RetentionSummary(BaseModel):
    active_words: int
    reviewed_words: int
    never_reviewed_words: int
    improved_words: int
    regressed_words: int
    strong_words: int
    weak_words: int
    parked_words: int
    reviewed_word_share_pct: int
    improved_word_share_pct: int
    regressed_word_share_pct: int


class EfficiencySummary(BaseModel):
    total_review_events: int
    reviews_per_active_minute: float
    improved_events_per_active_minute: float
    net_events_per_active_minute: float
    reviewed_words_per_session: float
    improved_words_per_session: float


class ConsistencySummary(BaseModel):
    active_streak_days: int
    study_streak_days: int
    longest_active_streak_days: int
    longest_study_streak_days: int
    active_days_last_30d: int
    study_days_last_30d: int
    active_days_last_90d: int
    study_days_last_90d: int


class QueueSummary(BaseModel):
    total_queues: int
    active_queues: int
    completed_queues: int
    completion_rate_pct: int
    avg_queue_size: int
    avg_completion_ratio_pct: int
    avg_completion_seconds: int


class UsageEventCreate(BaseModel):
    event_key: str = Field(min_length=8, max_length=64)
    session_key: str = Field(min_length=8, max_length=64)
    route: str | None = Field(default=None, max_length=128)
    active_seconds: int = Field(gt=0, le=60 * 60 * 24)


class VocabularyOverview(BaseModel):
    total_words: int
    total_topics: int
    with_example: int
    with_examples_3plus: int
    with_pos: int
    missing_example: int
    needs_example_enrichment: int
    missing_pos: int
    needs_enrichment: int   # missing example OR pos


class StatsResponse(BaseModel):
    overview: VocabularyOverview
    level_counts: LevelCounts
    okay_or_better_pct: int
    usage_summary: UsageSummary
    retention_summary: RetentionSummary
    efficiency_summary: EfficiencySummary
    consistency_summary: ConsistencySummary
    queue_summary: QueueSummary
    usage_daily: list[UsageDay]
    topics: list[TopicStat]
    daily_activity: list[DailyActivity]   # all recorded days, newest first
    words_added_by_month: dict[str, int]  # "YYYY-MM" -> count, all months with data
    tracking_started_at: str | None       # ISO date of first recorded event, or None
    usage_started_at: str | None          # ISO date of first usage event, or None
