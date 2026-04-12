from __future__ import annotations

from pydantic import BaseModel


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
    missing_pos: int


class DailyActivity(BaseModel):
    date: str            # YYYY-MM-DD
    reviewed: int        # distinct words whose level changed
    improved: int        # level went up
    downgraded: int      # level went down
    net: int             # improved - downgraded


class VocabularyOverview(BaseModel):
    total_words: int
    total_topics: int
    with_example: int
    with_pos: int
    missing_example: int
    missing_pos: int
    needs_enrichment: int   # missing example OR pos


class StatsResponse(BaseModel):
    overview: VocabularyOverview
    level_counts: LevelCounts
    okay_or_better_pct: int
    topics: list[TopicStat]
    daily_activity: list[DailyActivity]   # all recorded days, newest first
    words_added_by_month: dict[str, int]  # "YYYY-MM" -> count, all months with data
