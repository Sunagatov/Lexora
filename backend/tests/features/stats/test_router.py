from app.features.stats import router as stats_router
from app.features.stats.schemas import (
    DailyActivity,
    LevelCounts,
    StatsResponse,
    TopicStat,
    VocabularyOverview,
)


def test_get_stats_returns_result_from_compute_stats(monkeypatch) -> None:
    expected = StatsResponse(
        overview=VocabularyOverview(
            total_words=10,
            total_topics=3,
            with_example=7,
            with_examples_3plus=5,
            with_pos=8,
            missing_example=3,
            needs_example_enrichment=5,
            missing_pos=2,
            needs_enrichment=4,
        ),
        level_counts=LevelCounts(
            unset=1,
            level_1=2,
            level_2=2,
            level_3=3,
            level_4=1,
            level_5=1,
        ),
        okay_or_better_pct=50,
        topics=[
            TopicStat(
                id=1,
                name="Travel",
                slug="travel",
                total=4,
                progress=25,
                weak_count=3,
                strong_count=1,
                missing_example=2,
                needs_example_enrichment=3,
                missing_pos=1,
            )
        ],
        daily_activity=[
            DailyActivity(
                date="2026-01-01",
                reviewed=2,
                improved=1,
                downgraded=0,
                net=1,
            )
        ],
        words_added_by_month={"2026-01": 5},
        tracking_started_at="2026-01-01",
    )

    monkeypatch.setattr(stats_router, "compute_stats", lambda db: expected)

    db = object()
    result = stats_router.get_stats(db=db)

    assert result is expected
