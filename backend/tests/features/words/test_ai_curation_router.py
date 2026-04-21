from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.features.words.ai_curation import router as ai_curation_router
from app.features.words.ai_curation.schemas import (
    AiCurationImportRequest,
    AiCurationImportResponse,
    AiCurationTopicListResponse,
    AiCurationTopicSummary,
    AiCurationTopicWordsResponse,
    AiCurationAllowedValues,
    AiCurationWord,
    PaginationMeta,
)
from app.features.words.ai_curation.service import AiCurationImportError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _topic_summary(**kwargs):
    defaults = dict(id=1, name="Banking", slug="banking", description=None, is_active=True, word_count=3)
    defaults.update(kwargs)
    return AiCurationTopicSummary(**defaults)


def _pagination(**kwargs):
    defaults = dict(page=1, page_size=50, total_items=1, total_pages=1)
    defaults.update(kwargs)
    return PaginationMeta(**defaults)


def _topic_list_response(items=None, pagination=None):
    return AiCurationTopicListResponse(
        items=items or [_topic_summary()],
        pagination=pagination or _pagination(),
    )


def _word():
    return AiCurationWord(
        id=10,
        topic_ids=[1],
        term="mortgage",
        translations="ипотека",
        translation_entries=["ипотека"],
        pattern=None,
        example_entries=["They applied for a mortgage."],
        countability="Countable",
        part_of_speech="noun",
        past_simple=None,
        past_participle=None,
        notes=None,
        knowledge_level=2,
        is_active=True,
    )


def _words_response():
    return AiCurationTopicWordsResponse(
        source_topic=_topic_summary(),
        pagination=_pagination(total_items=1),
        allowed_values=AiCurationAllowedValues(
            countability=["Countable", "Uncountable"],
            part_of_speech=["noun", "verb"],
        ),
        instructions=["Return valid JSON only."],
        words=[_word()],
    )


def _import_response(**kwargs):
    defaults = dict(
        source_topic_id=1,
        source_topic_name="Banking",
        dry_run=False,
        created_topics=[],
        created_words=0,
        updated_words=0,
        reassigned_words=0,
        unchanged=0,
        created_word_ids=[],
        updated_word_ids=[],
        reassigned_word_ids=[],
    )
    defaults.update(kwargs)
    return AiCurationImportResponse(**defaults)


# ---------------------------------------------------------------------------
# GET /api/ai-curation/topics
# ---------------------------------------------------------------------------

def test_list_topics_returns_paginated_response(monkeypatch) -> None:
    expected = _topic_list_response()
    monkeypatch.setattr(ai_curation_router, "list_topics_page", lambda db, page, page_size: expected)

    result = ai_curation_router.list_ai_curation_topics(page=1, page_size=50, db=object())

    assert result is expected
    assert len(result.items) == 1
    assert result.items[0].name == "Banking"
    assert result.pagination.page == 1


# ---------------------------------------------------------------------------
# GET /api/ai-curation/topics/{id}/words
# ---------------------------------------------------------------------------

def test_list_topic_words_returns_words_and_instructions(monkeypatch) -> None:
    expected = _words_response()
    monkeypatch.setattr(ai_curation_router, "export_topic_words_page", lambda db, topic_id, page, page_size: expected)

    result = ai_curation_router.list_ai_curation_topic_words(topic_id=1, page=1, page_size=100, db=object())

    assert result is expected
    assert len(result.words) == 1
    assert result.instructions[0] == "Return valid JSON only."


def test_list_topic_words_raises_404_for_missing_topic(monkeypatch) -> None:
    def raise_error(db, topic_id, page, page_size):
        raise AiCurationImportError("Topic 99 not found")

    monkeypatch.setattr(ai_curation_router, "export_topic_words_page", raise_error)

    with pytest.raises(HTTPException) as exc_info:
        ai_curation_router.list_ai_curation_topic_words(topic_id=99, page=1, page_size=100, db=object())

    assert exc_info.value.status_code == 404
    assert "99" in exc_info.value.detail


# ---------------------------------------------------------------------------
# POST /api/ai-curation/import — router layer
# ---------------------------------------------------------------------------

def _minimal_import_payload(dry_run: bool = False) -> AiCurationImportRequest:
    return AiCurationImportRequest(
        schema_version="lexora.ai-curation.v1",
        source_topic_id=1,
        dry_run=dry_run,
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "collateral",
                "translations": "залог",
            }
        ],
    )


def test_import_router_returns_response_on_success(monkeypatch) -> None:
    expected = _import_response(created_words=1, created_word_ids=[42])
    monkeypatch.setattr(ai_curation_router, "import_ai_curation", lambda db, payload: expected)

    result = ai_curation_router.import_ai_curation_payload(_minimal_import_payload(), db=object())

    assert result is expected


def test_import_router_maps_error_to_400(monkeypatch) -> None:
    def raise_error(db, payload):
        raise AiCurationImportError("Term mismatch")

    monkeypatch.setattr(ai_curation_router, "import_ai_curation", raise_error)

    with pytest.raises(HTTPException) as exc_info:
        ai_curation_router.import_ai_curation_payload(_minimal_import_payload(), db=object())

    assert exc_info.value.status_code == 400
    assert "Term mismatch" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Service-level tests — import_ai_curation
# ---------------------------------------------------------------------------

from app.features.words.ai_curation import service as ai_curation_service


def _make_topic(id=1, name="Banking", slug="banking", deleted_at=None):
    t = SimpleNamespace(id=id, name=name, slug=slug, description=None, is_active=True, deleted_at=deleted_at)
    return t


def _make_word(id=10, term="mortgage", topics=None, translation_items=None, example_items=None):
    t = _make_topic()
    return SimpleNamespace(
        id=id,
        term=term,
        translations="ипотека",
        translation_items=translation_items or [],
        example_items=example_items or [],
        topics=topics if topics is not None else [t],
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


def _make_db_for_import(source_topic, word_map: dict):
    """Return a MagicMock db that resolves source topic and words."""
    db = MagicMock()

    def scalar_side_effect(stmt):
        return source_topic

    db.scalar.side_effect = scalar_side_effect

    def scalars_side_effect(stmt):
        mock = MagicMock()
        mock.all.return_value = list(word_map.values())
        return mock

    db.scalars.side_effect = scalars_side_effect
    return db


def test_import_dry_run_does_not_commit(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word()
    db = MagicMock()
    db.scalar.return_value = source

    calls = []

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

    monkeypatch.setattr(
        ai_curation_service, "create_topic",
        lambda db, payload, commit=True: new_topic,
    )
    monkeypatch.setattr(
        ai_curation_service, "create_word",
        lambda db, payload, commit=True: new_word,
    )

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        topic_operations=[
            {"op": "create_topic", "client_key": "retail-banking", "name": "Retail Banking"},
        ],
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
    monkeypatch.setattr(
        ai_curation_service, "update_word",
        lambda db, w, payload, commit=True: updated_word,
    )

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

    def scalar_side_effect(stmt):
        return source

    db.scalar.side_effect = scalar_side_effect

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars

    resolved_topic2 = topic2
    original_resolve = ai_curation_service._resolve_topic_ref

    def patched_resolve(db, ref, created_topics):
        if ref.topic_id == 2:
            return resolved_topic2
        return original_resolve(db, ref, created_topics)

    monkeypatch.setattr(ai_curation_service, "_resolve_topic_ref", patched_resolve)

    updated = _make_word(id=10, term="mortgage", topics=[topic2])
    monkeypatch.setattr(
        ai_curation_service, "update_word",
        lambda db, w, payload, commit=True: updated,
    )

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


# ---------------------------------------------------------------------------
# Validation: term mismatch
# ---------------------------------------------------------------------------

def test_import_term_mismatch_raises_error(monkeypatch) -> None:
    source = _make_topic()
    word = _make_word(id=10, term="mortgage")

    db = MagicMock()
    db.scalar.return_value = source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[
            {
                "op": "update_existing_word",
                "id": 10,
                "term": "WRONG_TERM",
                "translation_entries": ["ипотека"],
            }
        ],
    )

    with pytest.raises(AiCurationImportError, match="term mismatch"):
        ai_curation_service.import_ai_curation(db, payload)


# ---------------------------------------------------------------------------
# Validation: duplicate client_key
# ---------------------------------------------------------------------------

def test_import_duplicate_client_key_raises_error(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    payload = AiCurationImportRequest(
        source_topic_id=1,
        topic_operations=[
            {"op": "create_topic", "client_key": "dup", "name": "Topic A"},
            {"op": "create_topic", "client_key": "dup", "name": "Topic B"},
        ],
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "bond",
                "translations": "облигация",
            }
        ],
    )

    with pytest.raises(AiCurationImportError, match="Duplicate topic client_keys"):
        ai_curation_service.import_ai_curation(db, payload)


# ---------------------------------------------------------------------------
# Validation: duplicate existing word id
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Validation: remove all topics from a word
# ---------------------------------------------------------------------------

def test_import_remove_all_topics_raises_error(monkeypatch) -> None:
    source = _make_topic(id=1)
    word = _make_word(id=10, term="mortgage", topics=[source])

    db = MagicMock()
    db.scalar.return_value = source

    def fake_scalars(stmt):
        m = MagicMock()
        m.all.return_value = [word]
        return m

    db.scalars.side_effect = fake_scalars

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[
            {
                "op": "reassign_word_topics",
                "id": 10,
                "term": "mortgage",
                "add_topic_refs": [],
                "remove_topic_ids": [1],
            }
        ],
    )

    with pytest.raises(AiCurationImportError, match="cannot end up without any topics"):
        ai_curation_service.import_ai_curation(db, payload)


# ---------------------------------------------------------------------------
# Validation: rollback on mid-request failure
# ---------------------------------------------------------------------------

def test_import_rollback_on_failure(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    def boom(db, payload, commit=True):
        raise RuntimeError("DB exploded")

    monkeypatch.setattr(ai_curation_service, "create_word", boom)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "bond",
                "translations": "облигация",
            }
        ],
    )

    with pytest.raises(RuntimeError):
        ai_curation_service.import_ai_curation(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# Schema-level validation
# ---------------------------------------------------------------------------

from pydantic import ValidationError


def test_schema_rejects_invalid_countability() -> None:
    with pytest.raises(ValidationError, match="countability"):
        AiCurationImportRequest(
            source_topic_id=1,
            word_operations=[
                {
                    "op": "update_existing_word",
                    "id": 1,
                    "term": "cash",
                    "countability": "Sometimes",
                }
            ],
        )


def test_schema_rejects_invalid_part_of_speech() -> None:
    with pytest.raises(ValidationError):
        AiCurationImportRequest(
            source_topic_id=1,
            word_operations=[
                {
                    "op": "create_new_word",
                    "target_topic_refs": [{"topic_id": 1}],
                    "term": "bond",
                    "translations": "облигация",
                    "part_of_speech": "emoji",
                }
            ],
        )


def test_topic_ref_requires_exactly_one_field() -> None:
    with pytest.raises(ValidationError, match="Exactly one"):
        AiCurationImportRequest(
            source_topic_id=1,
            word_operations=[
                {
                    "op": "create_new_word",
                    "target_topic_refs": [{"topic_id": 1, "client_key": "both"}],
                    "term": "bond",
                    "translations": "облигация",
                }
            ],
        )
