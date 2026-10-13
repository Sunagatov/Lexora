from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.features.topics.model import Topic
from app.features.words.model import PartsOfSpeech, Word, WordExample, WordTranslation
from app.features.words.repository import get_all_words, get_word_knowledge_summary
from app.features.words.router import router
from app.shared.db import Base
from app.shared.deps import get_db


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_weak_a1_sort_happens_before_pagination(db):
    # Insertion and alphabetical order deliberately disagree with learning order.
    words = [Word(term=f"a-{i:03}", knowledge_level=4, cefr_level="A1") for i in range(55)]
    words += [Word(term=f"b-{i:03}", knowledge_level=1, cefr_level="A2") for i in range(55)]
    words += [Word(term=f"z-{i:03}", knowledge_level=1, cefr_level="A1") for i in range(55)]
    db.add_all(words)
    db.commit()
    first, total = get_all_words(db, sort="level-asc", page=1, page_size=50)
    second, _ = get_all_words(db, sort="level-asc", page=2, page_size=50)
    assert total == 165
    assert [w.term for w in first] == [f"z-{i:03}" for i in range(50)]
    assert [w.term for w in second[:5]] == [f"z-{i:03}" for i in range(50, 55)]
    assert all(w.cefr_level == "A2" and w.knowledge_level == 1 for w in second[5:])
    assert not ({w.id for w in first} & {w.id for w in second})


def test_topic_sort_counts_multitopic_words_once_and_keeps_parked_last(db):
    parent = Topic(name="Parent", slug="parent")
    child = Topic(name="Child", slug="child", parent_topic=parent)
    db.add_all([parent, child])
    db.flush()
    db.add_all([
        Word(term="parked", knowledge_level=5, topics=[parent, child]),
        Word(term="weak", knowledge_level=1, topics=[child]),
        Word(term="strong", knowledge_level=4, topics=[parent, child]),
    ])
    db.commit()
    words, total = get_all_words(db, topic_id=parent.id, sort="level-desc", page=1, page_size=50)
    assert total == 3
    assert [w.term for w in words] == ["strong", "weak", "parked"]


def test_library_summary_includes_unassigned_and_unrated_but_not_deleted(db):
    topic = Topic(name="Topic", slug="topic")
    db.add(topic)
    db.flush()
    db.add_all([
        Word(term="weak", knowledge_level=1, topics=[topic]),
        Word(term="strong", knowledge_level=4),
        Word(term="parked", knowledge_level=5),
        Word(term="unrated", knowledge_level=2),
        Word(term="deleted", knowledge_level=4, deleted_at=datetime.now(UTC)),
    ])
    db.commit()
    unrated = db.query(Word).filter_by(term="unrated").one()
    unrated.knowledge_level = None
    db.commit()
    assert get_word_knowledge_summary(db) == {0: 1, 1: 1, 4: 1, 5: 1}


def test_search_finds_translations_and_examples_without_duplicate_rows(db):
    word = Word(term="run", knowledge_level=1)
    word.translation_items = [WordTranslation(position=0, value="бежать")]
    word.example_items = [WordExample(position=0, value="I run before breakfast.")]
    db.add(word)
    db.commit()
    for search in ("бежать", "breakfast"):
        words, total = get_all_words(db, search=search, sort="level-asc", page=1, page_size=50)
        assert total == 1
        assert words[0].term == "run"


def test_summary_route_and_sort_validation(db):
    db.add(Word(term="word", knowledge_level=4))
    db.commit()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        response = client.get("/api/words/summary")
        assert response.status_code == 200
        assert response.json() == {"total": 1, "level_counts": {"4": 1}}
        assert client.get("/api/words?sort=unknown").status_code == 422
        response = client.get("/api/words?sort=level-asc&page_size=50")
        assert response.status_code == 200
        assert response.json()["page_size"] == 50


def test_combines_or_within_groups_and_and_between_groups_with_topic_subtrees(db):
    parent = Topic(name="Parent", slug="parent")
    child = Topic(name="Child", slug="child", parent_topic=parent)
    other = Topic(name="Other", slug="other")
    noun, verb = PartsOfSpeech(name="noun"), PartsOfSpeech(name="verb")
    db.add_all([parent, child, other, noun, verb])
    db.flush()
    db.add_all([
        Word(term="weak-a1", knowledge_level=1, cefr_level="A1", part_of_speech=noun, topics=[parent, child]),
        Word(term="basic-a2", knowledge_level=2, cefr_level="A2", part_of_speech=verb, topics=[child]),
        Word(term="strong-a1", knowledge_level=4, cefr_level="A1", part_of_speech=noun, topics=[child]),
        Word(term="weak-b1", knowledge_level=1, cefr_level="B1", part_of_speech=noun, topics=[parent]),
        Word(term="unrelated", knowledge_level=1, cefr_level="A1", part_of_speech=noun, topics=[other]),
    ])
    db.commit()
    words, total = get_all_words(db, levels=[1, 2], cefr_levels=["A1", "A2"], positions=["noun", "verb"],
                                 topic_ids=[parent.id, child.id], sort="level-asc", then_sort="cefr-asc", page=1, page_size=50)
    assert total == 2
    assert [word.term for word in words] == ["weak-a1", "basic-a2"]
    words, total = get_all_words(db, topic_id=other.id, topic_ids=[parent.id], page=1, page_size=50)
    assert words == [] and total == 0


def test_primary_and_secondary_sorts_can_be_reordered_and_reversed(db):
    db.add_all([
        Word(term="alpha", knowledge_level=4, cefr_level="A1"),
        Word(term="bravo", knowledge_level=1, cefr_level="A2"),
        Word(term="zulu", knowledge_level=1, cefr_level="A1"),
        Word(term="charlie", knowledge_level=2, cefr_level="A1"),
    ])
    db.commit()
    def terms(primary, secondary):
        words, _ = get_all_words(db, sort=primary, then_sort=secondary, page=1, page_size=50)
        return [word.term for word in words]
    assert terms("level-asc", "cefr-asc") == ["zulu", "bravo", "charlie", "alpha"]
    assert terms("cefr-asc", "level-asc") == ["zulu", "charlie", "alpha", "bravo"]
    assert terms("level-asc", "cefr-desc") == ["bravo", "zulu", "charlie", "alpha"]
    assert terms("level-asc", "none") == ["bravo", "zulu", "charlie", "alpha"]


def test_repeated_filter_parameters_are_validated_by_the_api(db):
    db.add_all([Word(term="weak", knowledge_level=1, cefr_level="A1"), Word(term="basic", knowledge_level=2, cefr_level="A2")])
    db.commit()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        response = client.get("/api/words?levels=1&levels=2&cefr_levels=A1&cefr_levels=A2&sort=level-asc&then_sort=cefr-asc")
        assert response.status_code == 200
        assert response.json()["total"] == 2
        for invalid in ("levels=6", "cefr_levels=D1", "positions=invalid", "topic_ids=0", "then_sort=invalid"):
            assert client.get("/api/words?" + invalid).status_code == 422
