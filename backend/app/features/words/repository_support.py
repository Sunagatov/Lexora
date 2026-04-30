from __future__ import annotations

from app.features.words.constants import PROGRESS_SOURCE_MANUAL
from app.features.words.model import Word
from app.features.words.schemas import WordUpdate


def apply_word_update_payload(db, word: Word, payload: WordUpdate) -> None:
    for field, value in _word_attribute_updates(payload).items():
        setattr(word, field, value)

    if not _multivalue_update_requested(payload):
        return

    current_translations_text = word.translations
    current_example_text = getattr(word, "example", None)
    current_translation_entries = [item.value for item in getattr(word, "translation_items", [])]
    current_example_entries = [item.value for item in getattr(word, "example_items", [])]

    word.translation_items = []
    word.example_items = []
    db.flush()

    from app.features.words.multivalue import sync_word_multivalue_fields

    sync_word_multivalue_fields(
        word,
        payload.translations if "translations" in payload.model_fields_set else current_translations_text,
        _resolved_translation_entries(payload, current_translation_entries),
        payload.example if "example" in payload.model_fields_set else current_example_text,
        _resolved_example_entries(payload, current_example_entries),
    )


def record_word_level_change_if_needed(
    db,
    word: Word,
    payload: WordUpdate,
    old_level: int | None,
    *,
    record_level_change_fn,
) -> None:
    if "knowledge_level" not in payload.model_fields_set:
        return
    if payload.knowledge_level == old_level or payload.knowledge_level is None:
        return
    source = payload.progress_source or PROGRESS_SOURCE_MANUAL
    record_level_change_fn(db, int(word.id), old_level, int(payload.knowledge_level), source)


def _word_attribute_updates(payload: WordUpdate) -> dict[str, object]:
    return payload.model_dump(
        exclude_unset=True,
        exclude={
            "topic_ids",
            "progress_source",
            "translations",
            "translation_entries",
            "example",
            "example_entries",
        },
    )


def _multivalue_update_requested(payload: WordUpdate) -> bool:
    fields = payload.model_fields_set
    return "translations" in fields or "translation_entries" in fields or "example" in fields or "example_entries" in fields


def _resolved_translation_entries(payload: WordUpdate, current_translation_entries: list[str]) -> list[str] | None:
    if "translation_entries" in payload.model_fields_set:
        return payload.translation_entries
    if "translations" in payload.model_fields_set:
        return None
    return current_translation_entries


def _resolved_example_entries(payload: WordUpdate, current_example_entries: list[str]) -> list[str] | None:
    if "example_entries" in payload.model_fields_set:
        return payload.example_entries
    if "example" in payload.model_fields_set:
        return None
    return current_example_entries
