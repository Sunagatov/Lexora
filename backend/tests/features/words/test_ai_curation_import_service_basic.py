from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.words.ai_curation.schemas import AiCurationImportRequest, CreateTopicOperation
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


def test_import_dry_run_does_not_commit(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word()
    db = MagicMock()
    db.scalar.return_value = source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars

    monkeypatch.setattr(ai_curation_service, "create_word", lambda db, payload, commit=True: word)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=True,
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "collateral",
                "translations": "залог",
            }
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()
    assert result.dry_run is True
    assert result.created_words == 1


def test_import_live_commits(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=99, term="collateral")
    db = MagicMock()
    db.scalar.return_value = source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = []
        return m

    db.scalars.side_effect = fake_scalars

    monkeypatch.setattr(ai_curation_service, "create_word", lambda db, payload, commit=True: word)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "collateral",
                "translations": "залог",
            }
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    db.commit.assert_called_once()
    db.rollback.assert_not_called()
    assert result.created_words == 1
    assert result.created_word_ids == [99]


def test_import_with_new_topic_and_word(monkeypatch) -> None:
    source = _make_topic()
    new_topic = _make_topic(id=55, name="Retail Banking", slug="retail-banking")
    new_word = _make_word(id=101, term="overdraft", topics=[new_topic])

    db = MagicMock()
    db.scalar.return_value = source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = []
        return m

    db.scalars.side_effect = fake_scalars

    monkeypatch.setattr(ai_curation_service, "create_topic", lambda db, payload, commit=True: new_topic)
    monkeypatch.setattr(ai_curation_service, "create_word", lambda db, payload, commit=True: new_word)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        topic_operations=[CreateTopicOperation(client_key="retail-banking", name="Retail Banking")],
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"client_key": "retail-banking"}],
                "term": "overdraft",
                "translations": "овердрафт",
            }
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    assert result.created_words == 1
    assert result.created_word_ids == [101]
    assert len(result.created_topics) == 1
    assert result.created_topics[0].client_key == "retail-banking"


def test_import_update_existing_word_enriches_entries(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=10, term="mortgage")

    db = MagicMock()
    db.scalar.return_value = source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars

    updated_word = _make_word(id=10, term="mortgage")
    monkeypatch.setattr(ai_curation_service, "update_word", lambda db, w, payload, commit=True: updated_word)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        word_operations=[
            {
                "op": "update_existing_word",
                "id": 10,
                "term": "mortgage",
                "translation_entries": ["ипотека", "жилищный кредит"],
                "example_entries": ["They applied for a mortgage.", "Mortgage rates rose."],
                "part_of_speech": "noun",
            }
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    assert result.updated_words == 1
    assert result.updated_word_ids == [10]


def test_import_reassign_adds_and_removes_topics(monkeypatch) -> None:
    topic1 = _make_topic(id=1, name="Banking")
    topic2 = _make_topic(id=2, name="Retail Banking")
    source = topic1
    word = _make_word(id=10, term="mortgage", topics=[topic1])

    db = MagicMock()
    db.scalar.side_effect = lambda stmt: source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars

    original_resolve = ai_curation_service._resolve_topic_ref

    def patched_resolve(db, ref, created_topics):
        if ref.topic_id == 2:
            return topic2
        return original_resolve(db, ref, created_topics)

    monkeypatch.setattr(ai_curation_service, "_resolve_topic_ref", patched_resolve)
    monkeypatch.setattr(ai_curation_service, "update_word", lambda db, w, payload, commit=True: _make_word(id=10, term="mortgage", topics=[topic2]))

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        word_operations=[
            {
                "op": "reassign_word_topics",
                "id": 10,
                "term": "mortgage",
                "add_topic_refs": [{"topic_id": 2}],
                "remove_topic_ids": [1],
            }
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    assert result.reassigned_words == 1
    assert result.reassigned_word_ids == [10]
