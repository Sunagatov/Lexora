from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.words.ai_curation import service as ai_curation_service


def _make_topic(id=1, name="Banking", slug="banking", deleted_at=None):
    return SimpleNamespace(id=id, name=name, slug=slug, description=None, is_active=True, deleted_at=deleted_at)


def _make_word(id=10, term="mortgage", topics=None, translation_items=None, example_items=None):
    topic = _make_topic()
    return SimpleNamespace(
        id=id,
        term=term,
        translations="ипотека",
        translation_items=translation_items or [],
        example_items=example_items or [],
        topics=topics if topics is not None else [topic],
        countability=None,
        part_of_speech=None,
        past_simple=None,
        past_participle=None,
        pattern=None,
        notes=None,
        knowledge_level=None,
        is_active=True,
        deleted_at=None,
    )


def _make_db(topic, words):
    db = MagicMock()

    def fake_scalar(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        if "from topics" in sql.lower():
            return topic
        return 1

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        m = MagicMock()
        m._sql = sql
        m.all.return_value = words
        return m

    db.scalar.side_effect = fake_scalar
    db.scalars.side_effect = fake_scalars
    return db


def test_ai_curation_export_for_parent_topic_includes_child_topic_words(monkeypatch) -> None:
    parent = _make_topic(id=1, name="Parent")
    child = _make_topic(id=2, name="Child")
    word = _make_word(id=10, term="cat", topics=[child])
    captured_sql: list[str] = []

    db = _make_db(parent, [word])

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        captured_sql.append(sql)
        m = MagicMock()
        m.all.return_value = [word]
        return m

    def fake_scalar(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()
        captured_sql.append(sql)
        if "from topics" in sql and "join word_topics" not in sql:
            return parent
        return 1

    db.scalar.side_effect = fake_scalar
    db.scalars.side_effect = fake_scalars
    monkeypatch.setattr(ai_curation_service, "get_active_subtree_topic_ids", lambda db, topic_id: [1, 2])

    result = ai_curation_service.export_topic_words_page(db, topic_id=1, page=1, page_size=20)

    assert result.source_topic.id == 1
    assert [item.id for item in result.words] == [10]
    assert any("select distinct" in sql.lower() for sql in captured_sql)
    assert any("count(distinct" in sql.lower() for sql in captured_sql)
    assert any("topics.id in (1, 2)" in sql.lower() for sql in captured_sql)


def test_ai_curation_lean_export_for_parent_topic_includes_child_topic_words(monkeypatch) -> None:
    parent = _make_topic(id=1, name="Parent")
    child = _make_topic(id=2, name="Child")
    word = _make_word(id=10, term="cat", topics=[child])
    captured_sql: list[str] = []

    db = _make_db(parent, [word])

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        captured_sql.append(sql)
        m = MagicMock()
        m.all.return_value = [word]
        return m

    def fake_scalar(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()
        captured_sql.append(sql)
        if "from topics" in sql and "join word_topics" not in sql:
            return parent
        return 1

    db.scalar.side_effect = fake_scalar
    db.scalars.side_effect = fake_scalars
    monkeypatch.setattr(ai_curation_service, "get_active_subtree_topic_ids", lambda db, topic_id: [1, 2])

    result = ai_curation_service.export_topic_words_lean_page(db, topic_id=1, page=1, page_size=20)

    assert result.source_topic_id == 1
    assert result.total_words == 1
    assert [item.id for item in result.words] == [10]
    assert any("select distinct" in sql.lower() for sql in captured_sql)
    assert any("count(distinct" in sql.lower() for sql in captured_sql)
    assert any("topics.id in (1, 2)" in sql.lower() for sql in captured_sql)


def test_ai_curation_export_deduplicates_word_present_in_multiple_topics_of_same_subtree(monkeypatch) -> None:
    parent = _make_topic(id=1, name="Parent")
    child = _make_topic(id=2, name="Child")
    shared_word = _make_word(id=10, term="cat", topics=[parent, child])
    captured_sql: list[str] = []

    db = _make_db(parent, [shared_word])

    def fake_scalars(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        captured_sql.append(sql)
        m = MagicMock()
        m.all.return_value = [shared_word]
        return m

    def fake_scalar(stmt):
        sql = str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()
        captured_sql.append(sql)
        if "from topics" in sql and "join word_topics" not in sql:
            return parent
        return 1

    db.scalar.side_effect = fake_scalar
    db.scalars.side_effect = fake_scalars
    monkeypatch.setattr(ai_curation_service, "get_active_subtree_topic_ids", lambda db, topic_id: [1, 2])

    result = ai_curation_service.export_topic_words_page(db, topic_id=1, page=1, page_size=20)

    assert [item.id for item in result.words] == [10]
    assert any("select distinct" in sql.lower() for sql in captured_sql)
