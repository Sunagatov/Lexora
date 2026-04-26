from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import cast

from app.scripts import deduplicate_words
from app.features.words.model import Word


def _topic(topic_id: int):
    return SimpleNamespace(id=topic_id)


def _entry(value: str):
    return SimpleNamespace(value=value)


def _word(
    *,
    word_id: int,
    term: str,
    knowledge_level: int | None,
    updated_at: datetime,
    deleted_at=None,
    topics=None,
    translation_entries=None,
    example_entries=None,
    notes=None,
    pattern=None,
    part_of_speech=None,
    countability=None,
    past_simple=None,
    past_participle=None,
):
    return SimpleNamespace(
        id=word_id,
        term=term,
        knowledge_level=knowledge_level,
        updated_at=updated_at,
        created_at=updated_at,
        deleted_at=deleted_at,
        topics=list(topics or []),
        translation_items=[_entry(value) for value in (translation_entries or [])],
        example_items=[_entry(value) for value in (example_entries or [])],
        translations="; ".join(translation_entries or []) or term,
        example="\n".join(example_entries or []) or None,
        notes=notes,
        pattern=pattern,
        part_of_speech=part_of_speech,
        countability=countability,
        past_simple=past_simple,
        past_participle=past_participle,
    )


def test_pick_canonical_prefers_active_highest_level_then_latest_update() -> None:
    older = _word(
        word_id=1,
        term="wolf",
        knowledge_level=3,
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        topics=[_topic(1)],
    )
    latest = _word(
        word_id=2,
        term="wolf",
        knowledge_level=3,
        updated_at=datetime(2026, 1, 3, tzinfo=timezone.utc),
        topics=[_topic(1)],
    )
    deleted = _word(
        word_id=3,
        term="wolf",
        knowledge_level=5,
        updated_at=datetime(2026, 1, 4, tzinfo=timezone.utc),
        deleted_at=object(),
        topics=[_topic(2)],
    )

    canonical = deduplicate_words._pick_canonical(cast(list[Word], cast(object, [older, latest, deleted])))

    assert canonical.id == 2


def test_build_merge_plan_unions_entries_topics_and_detects_conflicts() -> None:
    first = _word(
        word_id=10,
        term="Wolf",
        knowledge_level=2,
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        topics=[_topic(1)],
        translation_entries=["волк", "хищник"],
        example_entries=["A wolf howls."],
        notes="forest animal",
        part_of_speech="noun",
    )
    second = _word(
        word_id=11,
        term=" wolf ",
        knowledge_level=4,
        updated_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        topics=[_topic(2)],
        translation_entries=["ВОЛК", "зверь"],
        example_entries=["A wolf hunts in packs."],
        notes="wild mammal",
        part_of_speech="verb",
    )

    plan = deduplicate_words._build_merge_plan(
        cast(list[Word], cast(object, [first, second])),
        queue_rows_by_word_id={10: [(100, 7)], 11: [(101, 7), (102, 8)]},
        progress_counts={10: 1, 11: 3},
    )

    assert plan.canonical_id == 11
    assert plan.duplicate_ids == [10]
    assert plan.merged_topic_ids == [1, 2]
    assert plan.merged_translation_entries == ["волк", "хищник", "зверь"]
    assert plan.merged_example_entries == ["A wolf howls.", "A wolf hunts in packs."]
    assert plan.merged_notes == "forest animal\n\nwild mammal"
    assert plan.queue_items_to_delete == 1
    assert plan.queue_items_to_move == 0
    assert plan.progress_events_to_move == 1
    assert plan.singular_conflicts == {"part_of_speech": ["noun", "verb"]}


def test_merge_distinct_entries_preserves_order_case_insensitively() -> None:
    merged = deduplicate_words._merge_distinct_entries([" Wolf ", "wolf", "WOLF", "pack"])
    assert merged == ["Wolf", "pack"]
