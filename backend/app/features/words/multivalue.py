from __future__ import annotations

import re

from app.features.words.model import Word, WordExample, WordTranslation


def sync_word_multivalue_fields(
    word: Word,
    translations_text: str | None,
    translation_entries: list[str] | None,
    example_text: str | None,
    example_entries: list[str] | None,
) -> None:
    resolved_translations = _resolve_translation_entries(translations_text, translation_entries)
    resolved_examples = _resolve_example_entries(example_text, example_entries)

    word.translations = _build_translation_summary(resolved_translations, translations_text)
    if example_entries is not None:
        word.example = "\n".join(resolved_examples) or None
    else:
        word.example = _build_example_summary(resolved_examples, example_text)

    word.translation_items = [
        WordTranslation(position=index, value=value)
        for index, value in enumerate(resolved_translations)
    ]
    word.example_items = [
        WordExample(position=index, value=value)
        for index, value in enumerate(resolved_examples)
    ]


def _clean_entries(values: list[str] | None) -> list[str]:
    if not values:
        return []

    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        value = raw.strip()
        if not value:
            continue
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _resolve_translation_entries(raw_text: str | None, explicit_entries: list[str] | None) -> list[str]:
    if explicit_entries is not None:
        cleaned = _clean_entries(explicit_entries)
        if cleaned:
            return cleaned
    return _split_translation_text(raw_text)


def _resolve_example_entries(raw_text: str | None, explicit_entries: list[str] | None) -> list[str]:
    if explicit_entries is not None:
        return _clean_entries(explicit_entries)
    return _split_example_text(raw_text)


def _split_translation_text(value: str | None) -> list[str]:
    if value is None:
        return []
    text = value.strip()
    if not text:
        return []
    return _clean_entries(re.split(r"(?:\r?\n|;)+", text))


def _split_example_text(value: str | None) -> list[str]:
    if value is None:
        return []
    text = value.strip()
    if not text:
        return []
    return _clean_entries(text.replace("\r\n", "\n").replace("\r", "\n").split("\n"))


def _build_translation_summary(entries: list[str], fallback_raw_text: str | None) -> str:
    if entries:
        return "; ".join(entries)
    return (fallback_raw_text or "").strip()


def _build_example_summary(entries: list[str], fallback_raw_text: str | None) -> str | None:
    if entries:
        return "\n".join(entries)
    raw = (fallback_raw_text or "").strip()
    return raw or None
