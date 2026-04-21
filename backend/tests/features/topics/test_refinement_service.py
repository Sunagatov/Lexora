from unittest.mock import MagicMock

from app.features.topics import refinement_service as topic_refinement_service
from app.features.topics.refinement_schemas import TopicSplitPlanRequest


def _make_split_words(make_word, *, start_id: int, term: str, count: int):
    return [make_word(id=start_id + idx, term=term) for idx in range(count)]


def test_build_topic_audit_only_flags_topics_with_300_or_more_words(monkeypatch, make_topic, make_word) -> None:
    under_topic = make_topic(
        id=1,
        name="Home Chores DIY Repairs Appliances",
        words=_make_split_words(make_word, start_id=1, term="mop", count=299),
    )
    over_topic = make_topic(
        id=2,
        name="Home Chores DIY Repairs Appliances",
        words=_make_split_words(make_word, start_id=400, term="hammer", count=300),
    )
    db = MagicMock()
    monkeypatch.setattr(topic_refinement_service, "get_all_topics_with_words", lambda db: [under_topic, over_topic])

    result = topic_refinement_service.build_topic_audit(db)

    assert [item.topic_id for item in result.items] == [2, 1]
    assert result.items[0].should_review is True
    assert "meets the 300+ word split threshold" in result.items[0].reasons
    assert result.items[1].should_review is False


def test_build_topic_split_plan_skips_topics_under_300_words(monkeypatch, make_topic, make_word) -> None:
    source_topic = make_topic(
        id=33,
        name="Home Chores DIY Repairs Appliances",
        words=_make_split_words(make_word, start_id=1, term="mop", count=299),
    )
    db = MagicMock()
    monkeypatch.setattr(topic_refinement_service, "get_topic_by_id_with_words", lambda db, topic_id: source_topic)

    result = topic_refinement_service.build_topic_split_plan(
        db,
        33,
        TopicSplitPlanRequest(),
    )

    assert result.should_split is False
    assert result.proposed_subtopics == []
    assert result.unassigned_word_ids == [word.id for word in source_topic.words]
    assert any("fewer than 300 active words" in reason for reason in result.reasons)


def test_build_topic_split_plan_reuses_existing_topics_and_keeps_names_unique(
    monkeypatch,
    make_topic,
    make_word,
) -> None:
    existing_cleaning = make_topic(id=50, name="Cleaning Supplies", description="Existing cleaning topic")
    existing_tools = make_topic(id=51, name="DIY Hand Tools", description="Existing tools topic")
    existing_appliances = make_topic(id=52, name="Kitchen Appliances", description="Existing appliance topic")

    source_words = []
    source_words.extend(_make_split_words(make_word, start_id=1, term="mop", count=120))
    source_words.extend(_make_split_words(make_word, start_id=200, term="hammer", count=120))
    source_words.extend(_make_split_words(make_word, start_id=400, term="oven", count=60))

    source_topic = make_topic(
        id=33,
        name="Home Chores DIY Repairs Appliances",
        words=source_words,
    )
    db = MagicMock()
    monkeypatch.setattr(topic_refinement_service, "get_topic_by_id_with_words", lambda db, topic_id: source_topic)
    monkeypatch.setattr(
        topic_refinement_service,
        "get_all_topics",
        lambda db: [existing_cleaning, existing_tools, existing_appliances, source_topic],
    )

    result = topic_refinement_service.build_topic_split_plan(
        db,
        33,
        TopicSplitPlanRequest(max_new_topics=10, min_words_per_topic=20),
    )

    assert result.should_split is True
    assert len({item.name.casefold() for item in result.proposed_subtopics}) == len(result.proposed_subtopics)
    assert any(item.topic_id == 50 and item.is_new_topic is False for item in result.proposed_subtopics)
    assert any(item.topic_id == 51 and item.is_new_topic is False for item in result.proposed_subtopics)
    assert any(item.topic_id == 52 and item.is_new_topic is False for item in result.proposed_subtopics)
    assert all(
        topic_refinement_service._topic_name_similarity(left.name, right.name) < 0.8
        for index, left in enumerate(result.proposed_subtopics)
        for right in result.proposed_subtopics[index + 1 :]
    )
