from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Required by app.shared.config.Settings at import time.
os.environ.setdefault("APP_PASSWORD", "test-password")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("API_KEY", "test-api-key")


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def make_topic(fixed_now):
    def _make_topic(
        *,
        id: int = 1,
        name: str = "Topic",
        slug: str = "topic",
        description: str | None = None,
        parent_topic_id=None,
        is_active: bool = True,
        deleted_at=None,
        words=None,
        children=None,
        created_at=None,
        updated_at=None,
    ):
        return SimpleNamespace(
            id=id,
            name=name,
            slug=slug,
            description=description,
            parent_topic_id=parent_topic_id,
            is_active=is_active,
            deleted_at=deleted_at,
            words=list(words or []),
            children=list(children or []),
            created_at=created_at or fixed_now,
            updated_at=updated_at or fixed_now,
        )

    return _make_topic


@pytest.fixture
def make_word(fixed_now):
    def _make_word(
        *,
        id: int = 1,
        term: str = "word",
        translations: str = "translation",
        past_simple: str | None = None,
        past_participle: str | None = None,
        part_of_speech: str | None = None,
        knowledge_level: int | None = None,
        countability: str | None = None,
        pattern: str | None = None,
        example: str | None = None,
        notes: str | None = None,
        is_active: bool = True,
        deleted_at=None,
        deleted_via_topic_id=None,
        topics=None,
        created_at=None,
        updated_at=None,
    ):
        return SimpleNamespace(
            id=id,
            term=term,
            translations=translations,
            past_simple=past_simple,
            past_participle=past_participle,
            part_of_speech=part_of_speech,
            knowledge_level=knowledge_level,
            countability=countability,
            pattern=pattern,
            example=example,
            notes=notes,
            is_active=is_active,
            deleted_at=deleted_at,
            deleted_via_topic_id=deleted_via_topic_id,
            topics=list(topics or []),
            created_at=created_at or fixed_now,
            updated_at=updated_at or fixed_now,
        )

    return _make_word
