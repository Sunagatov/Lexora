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
        language: str = "en",
        definition: str | None = None,
        pronunciation_ipa: str | None = None,
        pronunciation_audio_url: str | None = None,
        image_url: str | None = None,
        part_of_speech=None,
        part_of_speech_id: int | None = None,
        cefr_level: str | None = None,
        register: str | None = None,
        countability: str | None = None,
        frequency_rank: int | None = None,
        knowledge_level: int | None = None,
        pattern: str | None = None,
        notes: str | None = None,
        is_active: bool = True,
        deleted_at=None,
        deleted_via_topic_id=None,
        topics=None,
        verb_form=None,
        translation_items=None,
        example_items=None,
        synonym_items=None,
        antonym_items=None,
        collocation_items=None,
        confusable_items=None,
        created_at=None,
        updated_at=None,
    ):
        return SimpleNamespace(
            id=id,
            term=term,
            language=language,
            definition=definition,
            pronunciation_ipa=pronunciation_ipa,
            pronunciation_audio_url=pronunciation_audio_url,
            image_url=image_url,
            part_of_speech=part_of_speech if part_of_speech is not None else (SimpleNamespace(name=None) if part_of_speech_id is None else SimpleNamespace(name="noun")),
            part_of_speech_id=part_of_speech_id,
            cefr_level=cefr_level,
            register=register,
            countability=countability,
            frequency_rank=frequency_rank,
            knowledge_level=knowledge_level,
            pattern=pattern,
            notes=notes,
            is_active=is_active,
            deleted_at=deleted_at,
            deleted_via_topic_id=deleted_via_topic_id,
            topics=list(topics or []),
            verb_form=verb_form,
            translation_items=list(translation_items or []),
            example_items=list(example_items or []),
            synonym_items=list(synonym_items or []),
            antonym_items=list(antonym_items or []),
            collocation_items=list(collocation_items or []),
            confusable_items=list(confusable_items or []),
            created_at=created_at or fixed_now,
            updated_at=updated_at or fixed_now,
        )

    return _make_word
