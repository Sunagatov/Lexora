from app.features.topics.domain import soft_delete_all_words, soft_delete_exclusive_words


def test_soft_delete_exclusive_words_only_marks_active_exclusive_words(make_topic, make_word, fixed_now) -> None:
    topic = make_topic(id=1)

    exclusive_active = make_word(id=1, deleted_at=None)
    exclusive_active.topics = [topic]
    exclusive_active.deleted_via_topic_id = None

    shared_active = make_word(id=2, deleted_at=None)
    shared_active.topics = [topic, make_topic(id=2, slug="other")]
    shared_active.deleted_via_topic_id = None

    exclusive_deleted = make_word(id=3, deleted_at=fixed_now)
    exclusive_deleted.topics = [topic]
    exclusive_deleted.deleted_via_topic_id = None

    topic.words = [exclusive_active, shared_active, exclusive_deleted]

    soft_delete_exclusive_words(topic, fixed_now)

    assert exclusive_active.deleted_at == fixed_now
    assert exclusive_active.deleted_via_topic_id == 1
    assert shared_active.deleted_at is None
    assert shared_active.deleted_via_topic_id is None
    assert exclusive_deleted.deleted_at == fixed_now
    assert exclusive_deleted.deleted_via_topic_id is None


def test_soft_delete_all_words_marks_all_active_words(make_topic, make_word, fixed_now) -> None:
    topic = make_topic(id=1)

    first = make_word(id=1, deleted_at=None)
    second = make_word(id=2, deleted_at=None)
    already_deleted = make_word(id=3, deleted_at=fixed_now)

    topic.words = [first, second, already_deleted]

    soft_delete_all_words(topic, fixed_now)

    assert first.deleted_at == fixed_now
    assert first.deleted_via_topic_id == 1
    assert second.deleted_at == fixed_now
    assert second.deleted_via_topic_id == 1
    assert already_deleted.deleted_at == fixed_now
    assert already_deleted.deleted_via_topic_id is None
