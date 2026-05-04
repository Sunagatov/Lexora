from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from typing import cast

from app.features.stats import content_metrics as stats_content_metrics
from app.features.stats import service as stats_service
from app.features.stats.content_metrics import WordStatsSnapshot
from app.features.stats.schemas import DailyActivity, UsageDay, UsageEventCreate
from app.features.topics.model import Topic
from app.features.words.constants import PROGRESS_SOURCE_MANUAL
from app.features.words.model import Word
from app.features.words.progress import WordProgressEvent, record_level_change


def _topic_stub(**kwargs) -> Topic:
    return cast(Topic, cast(object, SimpleNamespace(**kwargs)))


def _word_stub(**kwargs) -> Word:
    return cast(Word, cast(object, SimpleNamespace(**kwargs)))


def _progress_event_stub(**kwargs) -> WordProgressEvent:
    return cast(WordProgressEvent, cast(object, SimpleNamespace(**kwargs)))


def test_record_level_change_adds_progress_event_to_session() -> None:
    db = MagicMock()

    record_level_change(
        db,
        word_id=10,
        old_level=1,
        new_level=3,
        source=PROGRESS_SOURCE_MANUAL,
    )

    event = db.add.call_args.args[0]
    assert isinstance(event, WordProgressEvent)
    assert event.word_id == 10
    assert event.old_level == 1
    assert event.new_level == 3
    assert event.source == PROGRESS_SOURCE_MANUAL


def test_record_usage_event_is_idempotent() -> None:
    db = MagicMock()
    payload = UsageEventCreate(
        event_key="event-123456",
        session_key="session-123456",
        route="/smart-review",
        active_seconds=17,
    )

    stats_service.record_usage_event(db, payload)

    assert db.execute.call_count == 1
    statement = db.execute.call_args.args[0]
    assert "app_usage_events" in str(statement)
    assert "ON CONFLICT" in str(statement).upper()
    assert db.add.call_count == 0


def test_build_overview_counts_completeness_and_okay_percentage(make_word) -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    words = [
        WordStatsSnapshot(id=1, knowledge_level=1, has_pos=True, example_items=(SimpleNamespace(value="ex"),), created_at=now),
        WordStatsSnapshot(id=2, knowledge_level=3, has_pos=False, example_items=(SimpleNamespace(value="ex"),), created_at=now),
        WordStatsSnapshot(id=3, knowledge_level=4, has_pos=True, example_items=(), created_at=now),
        WordStatsSnapshot(id=4, knowledge_level=5, has_pos=False, example_items=(), created_at=now),
        WordStatsSnapshot(id=5, knowledge_level=None, has_pos=False, example_items=(), created_at=now),
    ]

    overview, level_counts, okay_pct = stats_service._build_overview(words)

    assert overview.total_words == 5
    assert overview.with_example == 2
    assert overview.with_examples_3plus == 0
    assert overview.with_pos == 2
    assert overview.missing_example == 3
    assert overview.needs_example_enrichment == 5
    assert overview.missing_pos == 3
    assert overview.needs_enrichment == 4

    assert level_counts[1] == 1
    assert level_counts[3] == 1
    assert level_counts[4] == 1
    assert level_counts[5] == 1
    assert level_counts[None] == 1

    assert okay_pct == 67


def test_build_topic_stats_computes_progress_and_sorts_by_progress() -> None:
    db = MagicMock()
    db.execute.return_value.all.return_value = [
        (1, 1),
        (1, 2),
        (2, 3),
    ]

    topics = [_topic_stub(id=1, name="Travel", slug="travel"), _topic_stub(id=2, name="Work", slug="work")]
    word_map = {
        1: WordStatsSnapshot(id=1, knowledge_level=1, has_pos=True, example_items=(), created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
        2: WordStatsSnapshot(id=2, knowledge_level=4, has_pos=True, example_items=(SimpleNamespace(value="ex"),), created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
        3: WordStatsSnapshot(id=3, knowledge_level=1, has_pos=False, example_items=(), created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
    }

    result = stats_service._build_topic_stats(
        db,
        topics,
        word_map,
        reviewed_word_ids={1, 2, 3},
        regressed_word_ids={1},
    )

    assert [item.id for item in result] == [2, 1]

    work = result[0]
    assert work.progress == 0
    assert work.weak_count == 1
    assert work.strong_count == 0
    assert work.missing_example == 1
    assert work.needs_example_enrichment == 1
    assert work.missing_pos == 1
    assert work.reviewed_count == 1
    assert work.regressed_count == 0
    assert work.never_reviewed_count == 0

    travel = result[1]
    assert travel.progress == 50
    assert travel.total == 2
    assert travel.weak_count == 1
    assert travel.strong_count == 1
    assert travel.missing_example == 1
    assert travel.needs_example_enrichment == 2
    assert travel.missing_pos == 0
    assert travel.reviewed_count == 2
    assert travel.regressed_count == 1
    assert travel.never_reviewed_count == 0

    statement = db.execute.call_args.args[0]
    sql = str(statement.compile(compile_kwargs={"literal_binds": True})).lower()
    assert "where" in sql
    assert "word_id" in sql


def test_load_topic_word_ids_short_circuits_for_empty_word_map() -> None:
    db = MagicMock()

    result = stats_content_metrics._load_topic_word_ids(db, {})

    assert result == {}
    db.execute.assert_not_called()


def test_build_daily_activity_deduplicates_reviewed_words_per_day() -> None:
    events = [
        _progress_event_stub(
            word_id=1,
            old_level=1,
            new_level=2,
            created_at=datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc),
        ),
        _progress_event_stub(
            word_id=1,
            old_level=2,
            new_level=3,
            created_at=datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc),
        ),
        _progress_event_stub(
            word_id=2,
            old_level=4,
            new_level=2,
            created_at=datetime(2026, 1, 11, 9, 0, tzinfo=timezone.utc),
        ),
    ]

    activity, tracking_started_at = stats_service._build_daily_activity(events)

    assert tracking_started_at == "2026-01-10"

    assert activity[0].date == "2026-01-11"
    assert activity[0].reviewed == 1
    assert activity[0].improved == 0
    assert activity[0].downgraded == 1
    assert activity[0].net == -1

    assert activity[1].date == "2026-01-10"
    assert activity[1].reviewed == 1
    assert activity[1].improved == 2
    assert activity[1].downgraded == 0
    assert activity[1].net == 2


def test_build_retention_stats_counts_reviewed_improved_and_regressed_words(make_word) -> None:
    words = [
        make_word(id=1, knowledge_level=1),
        make_word(id=2, knowledge_level=3),
        make_word(id=3, knowledge_level=5),
    ]
    level_counts = {None: 0, 1: 1, 2: 0, 3: 1, 4: 0, 5: 1}

    result = stats_service._build_retention_stats(
        words,
        level_counts,
        reviewed_word_ids={1, 2},
        improved_word_ids={2},
        regressed_word_ids={1},
    )

    assert result.active_words == 2
    assert result.reviewed_words == 2
    assert result.never_reviewed_words == 1
    assert result.improved_words == 1
    assert result.regressed_words == 1
    assert result.strong_words == 1
    assert result.weak_words == 1
    assert result.parked_words == 1
    assert result.reviewed_word_share_pct == 67
    assert result.improved_word_share_pct == 50
    assert result.regressed_word_share_pct == 50


def test_build_consistency_stats_computes_active_and_study_streaks() -> None:
    usage_daily = [
        UsageDay(date="2026-01-12", active_seconds=10),
        UsageDay(date="2026-01-11", active_seconds=10),
        UsageDay(date="2026-01-09", active_seconds=10),
    ]
    daily_activity = [
        DailyActivity(date="2026-01-12", reviewed=1, improved=1, downgraded=0, net=1),
        DailyActivity(date="2026-01-11", reviewed=1, improved=0, downgraded=1, net=-1),
        DailyActivity(date="2026-01-10", reviewed=1, improved=1, downgraded=0, net=1),
    ]

    result = stats_service._build_consistency_stats(
        usage_daily,
        daily_activity,
        now=datetime(2026, 1, 12, 12, 0, tzinfo=timezone.utc),
    )

    assert result.active_streak_days == 2
    assert result.study_streak_days == 3
    assert result.longest_active_streak_days == 2
    assert result.longest_study_streak_days == 3
    assert result.active_days_last_30d == 3
    assert result.study_days_last_30d == 3
    assert result.active_days_last_90d == 3
    assert result.study_days_last_90d == 3


def test_build_queue_stats_aggregates_completion_and_duration() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(
            total_count=3,
            completed_count=3,
            is_active=False,
            expires_at=datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc),
            generated_at=datetime(2026, 1, 10, 11, 0, tzinfo=timezone.utc),
            items=[
                SimpleNamespace(completed_at=datetime(2026, 1, 10, 11, 20, tzinfo=timezone.utc)),
                SimpleNamespace(completed_at=datetime(2026, 1, 10, 11, 30, tzinfo=timezone.utc)),
            ],
        ),
        SimpleNamespace(
            total_count=2,
            completed_count=1,
            is_active=True,
            expires_at=datetime(2026, 1, 13, 12, 0, tzinfo=timezone.utc),
            generated_at=datetime(2026, 1, 12, 11, 0, tzinfo=timezone.utc),
            items=[SimpleNamespace(completed_at=datetime(2026, 1, 12, 11, 25, tzinfo=timezone.utc))],
        ),
    ]

    result = stats_service._build_queue_stats(db, now=datetime(2026, 1, 12, 12, 0, tzinfo=timezone.utc))

    assert result.total_queues == 2
    assert result.active_queues == 1
    assert result.completed_queues == 1
    assert result.completion_rate_pct == 50
    assert result.avg_queue_size == 2
    assert result.avg_completion_ratio_pct == 75
    assert result.avg_completion_seconds == 1800


def test_build_usage_stats_groups_by_day_and_session() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(
            session_key="session-a",
            active_seconds=30,
            route="/smart-review",
            created_at=datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            session_key="session-a",
            active_seconds=45,
            route="/topics/travel",
            created_at=datetime(2026, 1, 10, 11, 0, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            session_key="session-b",
            active_seconds=15,
            route="/stats",
            created_at=datetime(2026, 1, 11, 9, 0, tzinfo=timezone.utc),
        ),
    ]

    summary, daily, started_at = stats_service._build_usage_stats(db)

    assert started_at == "2026-01-10"
    assert summary.total_active_seconds == 90
    assert summary.active_days == 2
    assert summary.sessions == 2
    assert summary.avg_session_seconds == 45
    assert summary.longest_session_seconds == 75
    assert summary.today_active_seconds >= 0
    assert summary.last_7d_active_seconds >= 0

    assert daily[0].date == "2026-01-11"
    assert daily[0].active_seconds == 15
    assert daily[1].date == "2026-01-10"
    assert daily[1].active_seconds == 75


def test_build_words_added_by_month_uses_provided_words_list_not_all_words() -> None:
    # Only non-deleted words (deleted_at=None) are passed by compute_stats, so deleted
    # words must not appear in the monthly totals.
    active_word = _word_stub(
        id=1,
        deleted_at=None,
        created_at=datetime(2026, 3, 15, tzinfo=timezone.utc),
        source="manual",
    )

    active_words = [active_word]
    result = stats_service._build_words_added_by_month(active_words)

    assert result == {"2026-03": 1}


def test_build_words_added_by_month_excludes_deleted_words_via_caller_filter() -> None:
    # Callers pass only active words; deleted words with different created_at must be absent.
    active = _word_stub(
        id=1,
        deleted_at=None,
        created_at=datetime(2026, 1, 5, tzinfo=timezone.utc),
        source="manual",
    )
    active_words = [active]
    result = stats_service._build_words_added_by_month(active_words)

    assert "2026-01" in result
    assert result["2026-01"] == 1


def test_compute_stats_words_added_by_month_excludes_deleted_words() -> None:
    # End-to-end proof: compute_stats must only count active words in monthly totals.
    # The deleted word was created in January; the active word was created in March.
    # After the fix, January must be absent from words_added_by_month.
    active_word = SimpleNamespace(
        id=1,
        deleted_at=None,
        created_at=datetime(2026, 3, 15, tzinfo=timezone.utc),
        knowledge_level=2,
        part_of_speech_id=1,
        part_of_speech=SimpleNamespace(name="noun"),
        definition="a definition",
        pronunciation_ipa=None,
        source="manual",
        translation_items=[],
        example_items=[SimpleNamespace(value="ex")],
        synonym_items=[],
        antonym_items=[],
        collocation_items=[],
        confusable_items=[],
        cefr_level=None,
        register=None,
    )
    deleted_word_january = SimpleNamespace(
        id=2,
        deleted_at=datetime(2026, 3, 20, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 5, tzinfo=timezone.utc),
        knowledge_level=1,
        part_of_speech_id=None,
        example_items=[],
    )
    _ = deleted_word_january  # not returned by the active-words query — that's the invariant

    db = MagicMock()
    # compute_stats calls db.scalars four times in order:
    #   1. active words   (deleted_at IS NULL)
    #   2. active topics  (deleted_at IS NULL)
    #   3. AppUsageEvent in _build_usage_stats
    #   4. WordProgressEvent in _build_daily_activity
    db.scalars.side_effect = [
        MagicMock(**{"all.return_value": [active_word]}),
        MagicMock(**{"all.return_value": []}),
        MagicMock(**{"all.return_value": []}),
        MagicMock(**{"all.return_value": []}),
        MagicMock(**{"all.return_value": []}),
    ]
    db.execute.return_value.all.return_value = []  # word_topics join in _build_topic_stats

    result = stats_service.compute_stats(db)

    assert result.words_added_by_month == {"2026-03": 1}
    assert "2026-01" not in result.words_added_by_month
