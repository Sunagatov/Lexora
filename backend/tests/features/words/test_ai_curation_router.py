from __future__ import annotations

from unittest.mock import MagicMock

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
    defaults = dict(page=1, page_size=50, total_items=1, total_pages=1, has_next=False, has_prev=False)
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
        language="en",
        definition=None,
        translation_entries=["ипотека"],
        pattern=None,
        example_entries=["They applied for a mortgage."],
        example_count=1,
        example_target_count=3,
        example_status="partial",
        needs_example_enrichment=True,
        countability="countable",
        part_of_speech="noun",
        cefr_level=None,
        register=None,
        frequency_rank=None,
        verb_form=None,
        synonym_entries=[],
        antonym_entries=[],
        collocation_entries=[],
        confusable_entries=[],
        notes=None,
        knowledge_level=2,
        is_active=True,
    )


def _words_response():
    from datetime import datetime, timezone
    return AiCurationTopicWordsResponse(
        exported_at=datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        source_topic=_topic_summary(),
        pagination=_pagination(total_items=1),
        allowed_values=AiCurationAllowedValues(
            countability=["countable", "uncountable"],
            part_of_speech=["noun", "verb"],
            cefr_level=["A1", "A2"],
            register=["formal", "informal"],
            language=["en", "ru"],
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

    result = ai_curation_router.list_ai_curation_topics(page=1, page_size=50, db=MagicMock())

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

    result = ai_curation_router.list_ai_curation_topic_words(topic_id=1, page=1, page_size=100, db=MagicMock())

    assert result is expected
    assert len(result.words) == 1
    assert result.instructions[0] == "Return valid JSON only."


def test_list_topic_words_raises_404_for_missing_topic(monkeypatch) -> None:
    def raise_error(db, topic_id, page, page_size):
        raise AiCurationImportError("Topic 99 not found")

    monkeypatch.setattr(ai_curation_router, "export_topic_words_page", raise_error)

    with pytest.raises(HTTPException) as exc_info:
        ai_curation_router.list_ai_curation_topic_words(topic_id=99, page=1, page_size=100, db=MagicMock())

    assert exc_info.value.status_code == 404
    assert "99" in exc_info.value.detail


# ---------------------------------------------------------------------------
# POST /api/ai-curation/import — router layer
# ---------------------------------------------------------------------------

def _minimal_import_payload(dry_run: bool = False) -> AiCurationImportRequest:
    return AiCurationImportRequest(
        schema_version="lexora.ai-curation.v2",
        source_topic_id=1,
        dry_run=dry_run,
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "collateral",
                "translation_entries": ["залог"],
            }
        ],
    )


def test_import_router_returns_response_on_success(monkeypatch) -> None:
    expected = _import_response(created_words=1, created_word_ids=[42])
    monkeypatch.setattr(ai_curation_router, "import_ai_curation", lambda db, payload: expected)

    result = ai_curation_router.import_ai_curation_payload(_minimal_import_payload(), db=MagicMock())

    assert result is expected


def test_import_router_maps_error_to_400(monkeypatch) -> None:
    def raise_error(db, payload):
        raise AiCurationImportError("Term mismatch")

    monkeypatch.setattr(ai_curation_router, "import_ai_curation", raise_error)

    with pytest.raises(HTTPException) as exc_info:
        ai_curation_router.import_ai_curation_payload(_minimal_import_payload(), db=MagicMock())

    assert exc_info.value.status_code == 400
    assert "Term mismatch" in exc_info.value.detail
