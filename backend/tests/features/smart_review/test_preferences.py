from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.languages.catalog import configure_language
from app.features.preferences.schemas import PreferencesPatch, WordMixPreferences
from app.features.preferences.service import (
    configured_word_mix_preferences,
    get_preferences,
    update_preferences,
)
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.smart_review.selection import pick_configured_words
from app.features.smart_review.service import generate_queue, get_or_create_active_queue
from app.features.topics.model import Topic
from app.features.words.model import Word
from app.shared.db import Base


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def save_mix(db, **changes):
    return update_preferences(db, PreferencesPatch(word_mix=WordMixPreferences(**changes))).word_mix


def test_defaults_do_not_silently_enable_a_different_selection_algorithm(db):
    assert get_preferences(db).word_mix is not None
    assert configured_word_mix_preferences(db) is None
    update_preferences(db, PreferencesPatch(theme="light"))
    assert configured_word_mix_preferences(db) is None


@pytest.mark.parametrize("changes", [
    {"size": 0}, {"size": 1001}, {"size": 1.5}, {"size": True},
    {"levels": []}, {"levels": [2]}, {"levels": [1, 1]},
    {"cefr_levels": ["A0"]}, {"cooldown_days": -1}, {"cooldown_days": 366},
])
def test_invalid_mix_settings_are_rejected(changes):
    with pytest.raises(ValidationError):
        WordMixPreferences(**changes)


def test_settings_are_shared_across_languages_and_devices_and_partial_updates_merge(db):
    save_mix(db, size=50, levels=[1, 3], cefr_levels=["A1"], cooldown_days=7)
    configure_language(db, "es")
    updated = save_mix(db, size=100)
    assert updated.size == 100
    assert updated.levels == [1, 3]
    assert updated.cefr_levels == ["A1"]
    assert updated.cooldown_days == 7
    with Session(db.get_bind()) as another_device:
        assert get_preferences(another_device).word_mix == updated


def test_size_filters_language_and_no_duplicate_ids(db):
    topic = Topic(name="Everyday", slug="everyday")
    db.add_all([Word(term=f"word {i}", knowledge_level=1, cefr_level="A1", topics=[topic]) for i in range(75)])
    db.add_all([
        Word(term="different level", knowledge_level=4, cefr_level="A1"),
        Word(term="different cefr", knowledge_level=1, cefr_level="B1"),
        Word(term="foreign", language="es", knowledge_level=1, cefr_level="A1"),
        Word(term="deleted", knowledge_level=1, cefr_level="A1", deleted_at=datetime.now(UTC)),
    ])
    db.commit()
    preferences = WordMixPreferences(size=50, levels=[1], cefr_levels=["A1"], cooldown_days=0)
    for balance in [False, True]:
        words = pick_configured_words(db, preferences.model_copy(update={"balance_topics": balance}))
        assert len(words) == len({word.id for word in words}) == 50
        assert all(word.term.startswith("word ") and word.language == "en" for word in words)


def test_balancing_spreads_topics_without_imposing_a_hard_cap(db):
    first = Topic(name="First", slug="first")
    second = Topic(name="Second", slug="second")
    db.add_all([Word(term=f"first {i}", knowledge_level=1, topics=[first]) for i in range(60)])
    db.add_all([Word(term=f"second {i}", knowledge_level=1, topics=[second]) for i in range(30)])
    db.commit()
    words = pick_configured_words(db, WordMixPreferences(size=50, levels=[1], cooldown_days=0))
    assert sum(word.topics[0].id == first.id for word in words) == 25
    assert sum(word.topics[0].id == second.id for word in words) == 25


def test_repeat_cooldown_and_insufficient_matches(db):
    recent, old, fresh = [Word(term=term, knowledge_level=1) for term in ["recent", "old", "fresh"]]
    db.add_all([recent, old, fresh])
    db.flush()
    queue = StudyQueue(expires_at=datetime.now(UTC) + timedelta(days=1), total_count=2, completed_count=2, is_active=False)
    db.add(queue)
    db.flush()
    db.add_all([StudyQueueItem(queue_id=queue.id, word_id=word.id, position=i, is_completed=True,
                             completed_at=datetime.now(UTC) - timedelta(days=days))
                for i, (word, days) in enumerate([(recent, 0), (old, 10)])])
    db.commit()
    preferences = WordMixPreferences(size=50, levels=[1], cooldown_days=7)
    assert {word.term for word in pick_configured_words(db, preferences)} == {"old", "fresh"}
    assert len(pick_configured_words(db, preferences.model_copy(update={"cooldown_days": 0}))) == 3


def test_changes_preserve_current_set_until_next_generation(db):
    db.add_all([Word(term=f"word {i}", knowledge_level=1, cefr_level="A1") for i in range(80)])
    db.commit()
    save_mix(db, size=50, levels=[1], cooldown_days=0)
    first = generate_queue(db)
    first_ids = [item.word_id for item in first.items]
    save_mix(db, size=75, cefr_levels=["A1"])
    assert get_or_create_active_queue(db).id == first.id
    assert [item.word_id for item in first.items] == first_ids
    second = generate_queue(db)
    assert second.id != first.id
    assert second.total_count == 75
    assert first.is_active is False


def test_empty_set_can_recover_after_settings_are_changed(db):
    db.add(Word(term="hello", knowledge_level=1, cefr_level="A1"))
    db.commit()
    save_mix(db, levels=[4])
    assert generate_queue(db).total_count == 0
    save_mix(db, levels=[1])
    assert get_or_create_active_queue(db).total_count == 1
