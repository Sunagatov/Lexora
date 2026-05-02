"""Backward-compatibility shim.

Entry table sync (translations, examples, synonyms, etc.) is now handled
directly in repository.py via _sync_entry_tables / _sync_entry_tables_for_update.

This module is kept only so that existing imports from workbook/importer.py
don't break during the transition. The function signatures match the old API
but operate on the new schema (no flat translations/example columns).
"""
from __future__ import annotations

from app.features.words.model import Word, WordExample, WordTranslation


def sync_word_multivalue_fields(
    word: Word,
    translations_text: str | None,
    translation_entries: list[str] | None,
    example_text: str | None,
    example_entries: list[str] | None,
) -> None:
    """Sync translation_items and example_items from entry lists."""
    resolved_translations = _clean(translation_entries or _split(translations_text))
    resolved_examples = _clean(example_entries or _split(example_text))

    word.translation_items = [
        WordTranslation(position=i, value=v) for i, v in enumerate(resolved_translations)
    ]
    word.example_items = [
        WordExample(position=i, value=v) for i, v in enumerate(resolved_examples)
    ]


def _clean(entries: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in entries:
        v = raw.strip()
        if not v:
            continue
        key = v.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(v)
    return result


def _split(text: str | None) -> list[str]:
    if not text or not text.strip():
        return []
    import re
    return [p.strip() for p in re.split(r"(?:\r?\n|;)+", text) if p.strip()]
