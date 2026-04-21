from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import logging

from app.features.words.ai_curation import service as ai_curation_service
from app.features.words.ai_curation.schemas import AiCurationImportRequest, CreateTopicOperation
from app.features.words.ai_curation.service import AiCurationImportError


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


def test_update_existing_word_only_passes_set_fields_to_update_word(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=10, term="mortgage")

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    captured: list = []
    monkeypatch.setattr(ai_curation_service, "update_word", lambda db, w, payload, commit=True: captured.append(payload) or w)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[{"op": "update_existing_word", "id": 10, "term": "mortgage", "example_entries": ["Rates rose.", "Payments are due."]}],
    )

    ai_curation_service.import_ai_curation(db, payload)

    assert len(captured) == 1
    update_payload = captured[0]
    assert "example_entries" in update_payload.model_fields_set
    assert "progress_source" in update_payload.model_fields_set
    assert "translations" not in update_payload.model_fields_set
    assert "notes" not in update_payload.model_fields_set
    assert "countability" not in update_payload.model_fields_set


def test_strict_mode_allows_reassign_to_request_created_topic(monkeypatch) -> None:
    source = _make_topic(id=1)
    new_topic = _make_topic(id=55, name="Retail Banking")
    word = _make_word(id=10, term="mortgage", topics=[source])

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    monkeypatch.setattr(ai_curation_service, "create_topic", lambda db, payload, commit=True: new_topic)
    monkeypatch.setattr(ai_curation_service, "update_word", lambda db, w, payload, commit=True: w)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        strict_mode=True,
        topic_operations=[CreateTopicOperation(client_key="retail", name="Retail Banking")],
        word_operations=[{"op": "reassign_word_topics", "id": 10, "term": "mortgage", "add_topic_refs": [{"client_key": "retail"}], "remove_topic_ids": [1]}],
    )

    result = ai_curation_service.import_ai_curation(db, payload)
    assert result.reassigned_words == 1


def test_strict_mode_rejects_reassign_to_pre_existing_topic(monkeypatch) -> None:
    source = _make_topic(id=1)
    word = _make_word(id=10, term="mortgage", topics=[source])

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        strict_mode=True,
        word_operations=[{"op": "reassign_word_topics", "id": 10, "term": "mortgage", "add_topic_refs": [{"topic_id": 99}], "remove_topic_ids": [1]}],
    )

    import pytest

    with pytest.raises(AiCurationImportError, match="strict_mode"):
        ai_curation_service.import_ai_curation(db, payload)


def test_strict_mode_rejects_removing_non_source_topic(monkeypatch) -> None:
    source = _make_topic(id=1)
    other = _make_topic(id=2, name="Other")
    word = _make_word(id=10, term="mortgage", topics=[source, other])

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        strict_mode=True,
        word_operations=[{"op": "reassign_word_topics", "id": 10, "term": "mortgage", "add_topic_refs": [], "remove_topic_ids": [2]}],
    )

    import pytest

    with pytest.raises(AiCurationImportError, match="strict_mode"):
        ai_curation_service.import_ai_curation(db, payload)


def test_import_logs_audit_on_commit(monkeypatch, caplog) -> None:
    source = _make_topic()
    word = _make_word(id=99, term="collateral")

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    monkeypatch.setattr(ai_curation_service, "create_word", lambda db, payload, commit=True: word)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        word_operations=[{"op": "create_new_word", "target_topic_refs": [{"topic_id": 1}], "term": "collateral", "translations": "залог"}],
    )

    with caplog.at_level(logging.INFO, logger="app.features.words.ai_curation.service"):
        ai_curation_service.import_ai_curation(db, payload)

    assert any("ai_curation.import" in r.message for r in caplog.records)
    assert any("created_words=1" in r.message for r in caplog.records)
