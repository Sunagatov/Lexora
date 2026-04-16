def test_word_response_from_word_filters_deleted_topics(make_topic, make_word, fixed_now) -> None:
    active_topic = make_topic(
        id=1,
        name="Travel",
        slug="travel",
        deleted_at=None,
        created_at=fixed_now,
        updated_at=fixed_now,
    )
    deleted_topic = make_topic(
        id=2,
        name="Old",
        slug="old",
        deleted_at=fixed_now,
        created_at=fixed_now,
        updated_at=fixed_now,
    )

    word = make_word(
        id=10,
        term="plane",
        translations="самолет",
        part_of_speech="noun",
        knowledge_level=3,
        example="The plane is late.",
        notes="common travel word",
        topics=[active_topic, deleted_topic],
        created_at=fixed_now,
        updated_at=fixed_now,
    )

    from app.features.words.schemas import WordResponse

    response = WordResponse.from_word(word)

    assert response.id == 10
    assert response.term == "plane"
    assert response.translations == "самолет"
    assert response.part_of_speech == "noun"
    assert response.knowledge_level == 3
    assert response.example == "The plane is late."
    assert response.notes == "common travel word"
    assert response.topic_ids == [1]
    assert response.created_at == fixed_now
    assert response.updated_at == fixed_now