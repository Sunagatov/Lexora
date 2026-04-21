from unittest.mock import MagicMock

from app.features.topics import refinement_service as topic_refinement_service
from app.features.topics.refinement_schemas import TopicSplitPlanRequest


def test_build_topic_audit_scores_broad_topics_higher(monkeypatch, make_topic, make_word) -> None:
    hammer_word = make_word(id=2, term="hammer", topics=[make_topic(id=9, name="Tools")])
    socket_word = make_word(id=3, term="socket", topics=[make_topic(id=10, name="Electrical")])
    broad_topic = make_topic(
        id=1,
        name="Home Chores DIY Repairs Appliances",
        words=[
            make_word(id=1, term="mop"),
            hammer_word,
            socket_word,
        ],
    )
    hammer_word.topics.append(broad_topic)
    socket_word.topics.append(broad_topic)
    focused_topic = make_topic(id=2, name="Brunch", words=[make_word(id=4, term="toast")])
    db = MagicMock()
    monkeypatch.setattr(
        topic_refinement_service,
        "get_all_topics_with_words",
        lambda db: [focused_topic, broad_topic],
    )

    result = topic_refinement_service.build_topic_audit(db)

    assert [item.topic_id for item in result.items] == [1, 2]
    broad_item = result.items[0]
    assert broad_item.should_review is True
    assert "generic topic name" in broad_item.reasons
    assert broad_item.shared_word_count == 2


def test_build_topic_split_plan_groups_words_into_specific_subtopics(monkeypatch, make_topic, make_word) -> None:
    source_topic = make_topic(
        id=33,
        name="Home Chores DIY Repairs Appliances",
        words=[
            make_word(id=1, term="mop"),
            make_word(id=2, term="detergent"),
            make_word(id=3, term="hammer"),
            make_word(id=4, term="drill"),
            make_word(id=5, term="oven"),
            make_word(id=6, term="microwave"),
            make_word(id=7, term="socket"),
            make_word(id=8, term="plug"),
            make_word(id=9, term="leak"),
            make_word(id=10, term="paint"),
            make_word(id=11, term="shovel"),
            make_word(id=12, term="misc item"),
        ],
    )
    db = MagicMock()
    monkeypatch.setattr(
        topic_refinement_service,
        "get_topic_by_id_with_words",
        lambda db, topic_id: source_topic if topic_id == 33 else None,
    )

    result = topic_refinement_service.build_topic_split_plan(
        db,
        33,
        TopicSplitPlanRequest(max_new_topics=10, min_words_per_topic=1),
    )

    assert result.source_topic_id == 33
    assert result.should_split is True
    assert any(item.name == "Cleaning Tools and Supplies" for item in result.proposed_subtopics)
    assert any(item.name == "DIY Hand Tools" for item in result.proposed_subtopics)
    assert any(item.name == "Kitchen Appliances" for item in result.proposed_subtopics)
    assert any(item.name == "Electrical Fixtures and Wiring" for item in result.proposed_subtopics)
    assert any(item.name == "Plumbing and Heating" for item in result.proposed_subtopics)
    assert any(item.name == "Decorating and Surface Repair" for item in result.proposed_subtopics)
    assert any(item.name == "Garden and Outdoor Care" for item in result.proposed_subtopics)
    assert 12 in result.unassigned_word_ids
