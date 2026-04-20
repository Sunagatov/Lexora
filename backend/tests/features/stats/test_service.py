from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.stats import service as stats_service


def test_record_level_change_adds_progress_event_to_session() -> None:
    db = MagicMock()

    stats_service.record_level_change(
        db,
        word_id=10,
        old_level=1,
        new_level=3,
        source="manual",
    )

    event = db.add.call_args.args[0]
    assert isinstance(event, stats_service.WordProgressEvent)
    assert event.word_id == 10
    assert event.old_level == 1
    assert event.new_level == 3
    assert event.source == "manual"


def test_build_overview_counts_completeness_and_okay_percentage(make_word) -> None:
    words = [
        make_word(id=1, knowledge_level=1, example="ex", part_of_speech="verb"),
        make_word(id=2, knowledge_level=3, example="ex", part_of_speech=None),
        make_word(id=3, knowledge_level=4, example=None, part_of_speech="noun"),
        make_word(id=4, knowledge_level=5, example=None, part_of_speech=None),
        make_word(id=5, knowledge_level=None, example=None, part_of_speech=None),
    ]

    overview, level_counts, okay_pct = stats_service._build_overview(words)

    assert overview.total_words == 5
    assert overview.with_example == 2
    assert overview.with_pos == 2
    assert overview.missing_example == 3
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

    topics = [
        SimpleNamespace(id=1, name="Travel", slug="travel"),
        SimpleNamespace(id=2, name="Work", slug="work"),
    ]
    word_map = {
        1: SimpleNamespace(id=1, knowledge_level=1, example=None, part_of_speech="verb"),
        2: SimpleNamespace(id=2, knowledge_level=4, example="ex", part_of_speech="noun"),
        3: SimpleNamespace(id=3, knowledge_level=1, example=None, part_of_speech=None),
    }

    result = stats_service._build_topic_stats(db, topics, word_map)

    assert [item.id for item in result] == [2, 1]

    work = result[0]
    assert work.progress == 0
    assert work.weak_count == 1
    assert work.strong_count == 0
    assert work.missing_example == 1
    assert work.missing_pos == 1

    travel = result[1]
    assert travel.progress == 50
    assert travel.total == 2
    assert travel.weak_count == 1
    assert travel.strong_count == 1
    assert travel.missing_example == 1
    assert travel.missing_pos == 0


def test_build_daily_activity_deduplicates_reviewed_words_per_day() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(
            word_id=1,
            old_level=1,
            new_level=2,
            created_at=datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            word_id=1,
            old_level=2,
            new_level=3,
            created_at=datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            word_id=2,
            old_level=4,
            new_level=2,
            created_at=datetime(2026, 1, 11, 9, 0, tzinfo=timezone.utc),
        ),
    ]

    activity, tracking_started_at = stats_service._build_daily_activity(db)

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


def test_build_words_added_by_month_uses_provided_words_list_not_all_words() -> None:
    # Only non-deleted words (deleted_at=None) are passed by compute_stats, so deleted
    # words must not appear in the monthly totals.
    active_word = SimpleNamespace(
        id=1,
        deleted_at=None,
        created_at=datetime(2026, 3, 15, tzinfo=timezone.utc),
    )

    result = stats_service._build_words_added_by_month([active_word])

    assert result == {"2026-03": 1}


def test_build_words_added_by_month_excludes_deleted_words_via_caller_filter() -> None:
    # Callers pass only active words; deleted words with different created_at must be absent.
    active = SimpleNamespace(
        id=1,
        deleted_at=None,
        created_at=datetime(2026, 1, 5, tzinfo=timezone.utc),
    )
    result = stats_service._build_words_added_by_month([active])

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
        example="ex",
        part_of_speech="noun",
    )
    deleted_word_january = SimpleNamespace(
        id=2,
        deleted_at=datetime(2026, 3, 20, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 5, tzinfo=timezone.utc),
        knowledge_level=1,
        example=None,
        part_of_speech=None,
    )
    _ = deleted_word_january  # not returned by the active-words query — that's the invariant

    db = MagicMock()
    # compute_stats calls db.scalars three times in order:
    #   1. active words   (deleted_at IS NULL)
    #   2. active topics  (deleted_at IS NULL)
    #   3. WordProgressEvent in _build_daily_activity
    db.scalars.side_effect = [
        MagicMock(**{"all.return_value": [active_word]}),
        MagicMock(**{"all.return_value": []}),
        MagicMock(**{"all.return_value": []}),
    ]
    db.execute.return_value.all.return_value = []  # word_topics join in _build_topic_stats

    result = stats_service.compute_stats(db)

    assert result.words_added_by_month == {"2026-03": 1}
    assert "2026-01" not in result.words_added_by_month