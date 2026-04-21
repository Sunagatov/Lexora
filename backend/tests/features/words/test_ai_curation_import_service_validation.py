from __future__ import annotations

from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.features.topics.service import InvalidTopicNameError, TopicSlugConflictError
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


def test_import_term_mismatch_raises_error(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=10, term="mortgage")

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[{"op": "update_existing_word", "id": 10, "term": "WRONG_TERM", "translation_entries": ["ипотека"]}],
    )

    with pytest.raises(AiCurationImportError, match="term mismatch"):
        ai_curation_service.import_ai_curation(db, payload)


def test_import_duplicate_client_key_raises_error(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        topic_operations=[CreateTopicOperation(client_key="dup", name="Topic A"), CreateTopicOperation(client_key="dup", name="Topic B")],
        word_operations=[{"op": "create_new_word", "target_topic_refs": [{"topic_id": 1}], "term": "bond", "translations": "облигация"}],
    )

    with pytest.raises(AiCurationImportError, match="Duplicate topic client_keys"):
        ai_curation_service.import_ai_curation(db, payload)


def test_import_duplicate_existing_word_id_raises_error(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[
            {"op": "update_existing_word", "id": 10, "term": "mortgage", "translation_entries": ["ипотека"]},
            {"op": "update_existing_word", "id": 10, "term": "mortgage", "notes": "duplicate"},
        ],
    )

    with pytest.raises(AiCurationImportError, match="Duplicate existing word ids"):
        ai_curation_service.import_ai_curation(db, payload)


def test_import_remove_all_topics_raises_error(monkeypatch) -> None:
    source = _make_topic(id=1)
    word = _make_word(id=10, term="mortgage", topics=[source])

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[{"op": "reassign_word_topics", "id": 10, "term": "mortgage", "add_topic_refs": [], "remove_topic_ids": [1]}],
    )

    with pytest.raises(AiCurationImportError, match="cannot end up without any topics"):
        ai_curation_service.import_ai_curation(db, payload)


def test_schema_rejects_invalid_countability() -> None:
    with pytest.raises(Exception, match="countability"):
        AiCurationImportRequest(
            source_topic_id=1,
            word_operations=[{"op": "update_existing_word", "id": 1, "term": "cash", "countability": "Sometimes"}],
        )


def test_schema_rejects_invalid_part_of_speech() -> None:
    with pytest.raises(Exception):
        AiCurationImportRequest(
            source_topic_id=1,
            word_operations=[{"op": "create_new_word", "target_topic_refs": [{"topic_id": 1}], "term": "bond", "translations": "облигация", "part_of_speech": "emoji"}],
        )


def test_topic_ref_requires_exactly_one_field() -> None:
    with pytest.raises(Exception, match="Exactly one"):
        AiCurationImportRequest(
            source_topic_id=1,
            word_operations=[{"op": "create_new_word", "target_topic_refs": [{"topic_id": 1, "client_key": "both"}], "term": "bond", "translations": "облигация"}],
        )


def test_import_stale_update_rejected_when_word_modified_after_export(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=10, term="mortgage")
    export_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    word.updated_at = export_time + timedelta(hours=1)

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        exported_at=export_time,
        word_operations=[{"op": "update_existing_word", "id": 10, "term": "mortgage", "translation_entries": ["ипотека"]}],
    )

    with pytest.raises(AiCurationImportError, match="was modified after export"):
        ai_curation_service.import_ai_curation(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_import_stale_check_skipped_when_exported_at_is_none(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=10, term="mortgage")
    word.updated_at = datetime(2099, 1, 1, tzinfo=timezone.utc)

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    captured: list[int] = []
    monkeypatch.setattr(ai_curation_service, "update_word", lambda db, w, payload, commit=True: captured.append(w.id) or w)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[{"op": "update_existing_word", "id": 10, "term": "mortgage", "translation_entries": ["ипотека", "жилищный кредит"]}],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    assert result.updated_words == 1
    assert 10 in captured


def test_import_stale_reassign_rejected_when_word_modified_after_export(monkeypatch) -> None:
    source = _make_topic(id=1)
    word = _make_word(id=10, term="mortgage", topics=[source])
    export_time = datetime(2025, 6, 1, 10, 0, 0, tzinfo=timezone.utc)
    word.updated_at = export_time + timedelta(minutes=30)

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word]})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        exported_at=export_time,
        word_operations=[{"op": "reassign_word_topics", "id": 10, "term": "mortgage", "add_topic_refs": [{"topic_id": 2}], "remove_topic_ids": [1]}],
    )

    with pytest.raises(AiCurationImportError, match="reassign_word_topics"):
        ai_curation_service.import_ai_curation(db, payload)


def test_import_topic_slug_conflict_is_normalized_to_ai_curation_import_error(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    def raise_slug_conflict(db, payload, commit=True):
        raise TopicSlugConflictError("Topic slug 'banking' already exists")

    monkeypatch.setattr(ai_curation_service, "create_topic", raise_slug_conflict)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        topic_operations=[CreateTopicOperation(client_key="banking", name="Banking")],
        word_operations=[],
    )

    with pytest.raises(AiCurationImportError, match="banking"):
        ai_curation_service.import_ai_curation(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_import_invalid_topic_name_is_normalized_to_ai_curation_import_error(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    def raise_invalid_name(db, payload, commit=True):
        raise InvalidTopicNameError("!!!!")

    monkeypatch.setattr(ai_curation_service, "create_topic", raise_invalid_name)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        topic_operations=[CreateTopicOperation(client_key="bad", name="!!!!")],
        word_operations=[],
    )

    with pytest.raises(AiCurationImportError, match="slug"):
        ai_curation_service.import_ai_curation(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()
