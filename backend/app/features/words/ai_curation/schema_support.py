from __future__ import annotations

from math import ceil

from pydantic import BaseModel, ConfigDict, Field

from app.features.words.constants import (
    CEFR_LEVELS,
    COUNTABILITY_VALUES,
    LANGUAGES,
    PART_OF_SPEECH_VALUES,
    REGISTER_VALUES,
)

SCHEMA_VERSION = "lexora.ai-curation.v2"
JsonEntry = str


def _json_entry_field():
    return Field(min_length=1, max_length=1000)


def _clean_entries(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    result: list[str] = []
    seen: set[str] = set()
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


def _normalize_optional_choice(value: str | None, allowed_values: tuple | list, field_name: str) -> str | None:
    if value in (None, ""):
        return None
    if value not in allowed_values:
        raise ValueError(f"{field_name} must be one of: {', '.join(allowed_values)}")
    return value


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def build(cls, page: int, page_size: int, total_items: int) -> "PaginationMeta":
        total_pages = max(1, ceil(total_items / page_size)) if page_size > 0 else 1
        return cls(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )


COMMON_MODEL_CONFIG = ConfigDict(extra="forbid", str_strip_whitespace=True)
COUNTABILITY_ALLOWED_VALUES = COUNTABILITY_VALUES
PART_OF_SPEECH_ALLOWED_VALUES = PART_OF_SPEECH_VALUES
CEFR_LEVEL_ALLOWED_VALUES = CEFR_LEVELS
REGISTER_ALLOWED_VALUES = REGISTER_VALUES
LANGUAGE_ALLOWED_VALUES = LANGUAGES
