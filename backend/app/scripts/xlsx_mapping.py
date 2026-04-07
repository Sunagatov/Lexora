from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any


IGNORED_SHEETS = {"Lists", "Start Here"}
SUPPORTED_KNOWLEDGE_LEVELS = {1, 2, 3, 4, 5}

VERB_HEADERS = ("Knowledge", "Word", "Russian translations", "Typical prepositions / patterns", "Examples (EN + RU)")
NOUN_HEADERS = ("Knowledge", "Word", "Russian translations", "Countability")
PHRASE_HEADERS = ("Knowledge", "Phrase", "Russian translations", "Meaning / usage note")
PLAIN_WORD_HEADERS = ("Knowledge", "Word", "Russian translations")
IRREGULAR_VERB_HEADERS = ("Knowledge", "Base form", "Past Simple", "Past Participle", "Russian translations", "Typical prepositions / patterns", "Examples (EN + RU)")
ADVERB_HEADERS = ("Knowledge", "Word", "Russian translations", "Typical position / usage")


@dataclass(frozen=True)
class SheetConfig:
    part_of_speech: str
    term_header: str
    translations_header: str
    countability_header: str | None = None
    pattern_header: str | None = None
    example_header: str | None = None
    notes_header: str | None = None
    past_simple_header: str | None = None
    past_participle_header: str | None = None


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_headers(row: tuple[Any, ...]) -> tuple[str, ...]:
    return tuple(t for v in row if (t := normalize_text(v)) is not None)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    if not slug:
        raise ValueError(f"Cannot build slug from sheet name: {value}")
    return slug[:200]


def parse_knowledge_level(value: Any, *, sheet_name: str, row_number: int) -> int:
    text = normalize_text(value)
    if text is None:
        raise ValueError(f"{sheet_name} row {row_number}: Knowledge is required")
    try:
        numeric = float(text)
    except ValueError as exc:
        raise ValueError(f"{sheet_name} row {row_number}: invalid Knowledge value '{text}'") from exc
    if not numeric.is_integer():
        raise ValueError(f"{sheet_name} row {row_number}: Knowledge must be an integer between 1 and 5")
    level = int(numeric)
    if level not in SUPPORTED_KNOWLEDGE_LEVELS:
        raise ValueError(f"{sheet_name} row {row_number}: Knowledge must be between 1 and 5")
    return level


def row_to_dict(headers: tuple[str, ...], row: tuple[Any, ...]) -> dict[str, Any]:
    return {header: (row[i] if i < len(row) else None) for i, header in enumerate(headers)}


def resolve_sheet_config(sheet_name: str, headers: tuple[str, ...]) -> SheetConfig:
    if headers == VERB_HEADERS:
        return SheetConfig(part_of_speech="verb", term_header="Word", translations_header="Russian translations", pattern_header="Typical prepositions / patterns", example_header="Examples (EN + RU)")
    if headers == NOUN_HEADERS:
        return SheetConfig(part_of_speech="noun", term_header="Word", translations_header="Russian translations", countability_header="Countability")
    if headers == PHRASE_HEADERS:
        return SheetConfig(part_of_speech="phrase", term_header="Phrase", translations_header="Russian translations", notes_header="Meaning / usage note")
    if headers == PLAIN_WORD_HEADERS:
        pos = "preposition" if sheet_name == "Prepositions" else "adjective"
        return SheetConfig(part_of_speech=pos, term_header="Word", translations_header="Russian translations")
    if headers == IRREGULAR_VERB_HEADERS:
        return SheetConfig(part_of_speech="verb", term_header="Base form", translations_header="Russian translations", pattern_header="Typical prepositions / patterns", example_header="Examples (EN + RU)", past_simple_header="Past Simple", past_participle_header="Past Participle")
    if headers == ADVERB_HEADERS:
        return SheetConfig(part_of_speech="adverb", term_header="Word", translations_header="Russian translations", pattern_header="Typical position / usage")
    raise ValueError(f"Unsupported sheet structure for '{sheet_name}'. Headers found: {headers}")


def is_empty_row(row_data: dict[str, Any], config: SheetConfig) -> bool:
    relevant = [config.term_header, config.translations_header, config.countability_header, config.pattern_header, config.example_header, config.notes_header, config.past_simple_header, config.past_participle_header]
    return all(normalize_text(row_data.get(h)) is None for h in relevant if h)


def is_repeated_header_row(row_data: dict[str, Any]) -> bool:
    return all(normalize_text(v) == h for h, v in row_data.items())
