from __future__ import annotations

from pydantic import BaseModel
from pydantic import Field


class LevelCounts(BaseModel):
    unset: int = 0
    level_1: int = 0
    level_2: int = 0
    level_3: int = 0
    level_4: int = 0
    level_5: int = 0


class TopicStat(BaseModel):
    id: int
    name: str
    slug: str
    total: int
    progress: int        # 0-100 weighted score
    weak_count: int      # levels 1-2
    strong_count: int    # levels 3-4
    missing_example: int = 0
    needs_example_enrichment: int = 0
    missing_pos: int = 0
    reviewed_count: int = 0
    regressed_count: int = 0
    never_reviewed_count: int = 0


class DailyActivity(BaseModel):
    date: str            # YYYY-MM-DD
    reviewed: int = 0    # distinct words whose level changed
    improved: int = 0    # level went up
    downgraded: int = 0  # level went down
    net: int = 0         # improved - downgraded


class UsageDay(BaseModel):
    date: str            # YYYY-MM-DD
    active_seconds: int = 0


class UsageSummary(BaseModel):
    total_active_seconds: int = 0
    active_days: int = 0
    sessions: int = 0
    avg_session_seconds: int = 0
    longest_session_seconds: int = 0
    today_active_seconds: int = 0
    last_7d_active_seconds: int = 0


class RetentionSummary(BaseModel):
    active_words: int = 0
    reviewed_words: int = 0
    never_reviewed_words: int = 0
    improved_words: int = 0
    regressed_words: int = 0
    strong_words: int = 0
    weak_words: int = 0
    parked_words: int = 0
    reviewed_word_share_pct: int = 0
    improved_word_share_pct: int = 0
    regressed_word_share_pct: int = 0


class EfficiencySummary(BaseModel):
    total_review_events: int = 0
    reviews_per_active_minute: float = 0.0
    improved_events_per_active_minute: float = 0.0
    net_events_per_active_minute: float = 0.0
    reviewed_words_per_session: float = 0.0
    improved_words_per_session: float = 0.0


class ConsistencySummary(BaseModel):
    active_streak_days: int = 0
    study_streak_days: int = 0
    longest_active_streak_days: int = 0
    longest_study_streak_days: int = 0
    active_days_last_30d: int = 0
    study_days_last_30d: int = 0
    active_days_last_90d: int = 0
    study_days_last_90d: int = 0


class QueueSummary(BaseModel):
    total_queues: int = 0
    active_queues: int = 0
    completed_queues: int = 0
    completion_rate_pct: int = 0
    avg_queue_size: int = 0
    avg_completion_ratio_pct: int = 0
    avg_completion_seconds: int = 0


class UsageEventCreate(BaseModel):
    event_key: str = Field(min_length=8, max_length=64)
    session_key: str = Field(min_length=8, max_length=64)
    route: str | None = Field(default=None, max_length=128)
    active_seconds: int = Field(gt=0, le=60 * 60 * 24)


class VocabularyOverview(BaseModel):
    total_words: int = 0
    total_topics: int = 0
    with_example: int = 0
    with_examples_3plus: int = 0
    with_pos: int = 0
    missing_example: int = 0
    needs_example_enrichment: int = 0
    missing_pos: int = 0
    needs_enrichment: int = 0   # missing example OR pos


class StatsResponse(BaseModel):
    overview: VocabularyOverview = Field(default_factory=VocabularyOverview)
    level_counts: LevelCounts = Field(default_factory=LevelCounts)
    okay_or_better_pct: int = 0
    usage_summary: UsageSummary = Field(default_factory=UsageSummary)
    retention_summary: RetentionSummary = Field(default_factory=RetentionSummary)
    efficiency_summary: EfficiencySummary = Field(default_factory=EfficiencySummary)
    consistency_summary: ConsistencySummary = Field(default_factory=ConsistencySummary)
    queue_summary: QueueSummary = Field(default_factory=QueueSummary)
    usage_daily: list[UsageDay] = Field(default_factory=list)
    topics: list[TopicStat] = Field(default_factory=list)
    daily_activity: list[DailyActivity] = Field(default_factory=list)   # all recorded days, newest first
    words_added_by_month: dict[str, int] = Field(default_factory=dict)  # "YYYY-MM" -> count, all months with data
    tracking_started_at: str | None = None      # ISO date of first recorded event, or None
    usage_started_at: str | None = None         # ISO date of first usage event, or None
