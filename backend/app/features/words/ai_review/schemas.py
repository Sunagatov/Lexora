from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES
from app.shared.constraints import (
    KNOWLEDGE_LEVEL_MAX,
    KNOWLEDGE_LEVEL_MIN,
    WORD_COUNT_MAX_LEN,
    WORD_POS_MAX_LEN,
    WORD_TERM_MAX_LEN,
    WORD_VERB_FORM_MAX_LEN,
)

SCHEMA_VERSION = "lexora.ai-review.v1"
JsonEntry = Annotated[str, Field(min_length=1, max_length=1000)]


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


class AiReviewTopic(BaseModel):
    id: int
    name: str


class AiReviewPagination(BaseModel):
    page: int
    page_size: int
    total_words: int
    total_pages: int


class AiReviewAllowedValues(BaseModel):
    countability: list[str]
    part_of_speech: list[str]


class AiReviewWord(BaseModel):
    id: int
    term: str
    translations: str
    translation_entries: list[str]
    pattern: str | None
    example_entries: list[str]
    countability: str | None
    part_of_speech: str | None
    past_simple: str | None
    past_participle: str | None
    notes: str | None
    knowledge_level: int | None


class AiReviewExportResponse(BaseModel):
    schema_version: Literal["lexora.ai-review.v1"] = SCHEMA_VERSION
    mode: Literal["enrich_existing_words_only"] = "enrich_existing_words_only"
    exported_at: datetime
    topic_id: int
    topic: AiReviewTopic
    pagination: AiReviewPagination
    allowed_values: AiReviewAllowedValues
    instructions: list[str]
    words: list[AiReviewWord]


class AiReviewImportWord(BaseModel):
    id: int = Field(gt=0)
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    translations: str | None = Field(default=None, min_length=1)
    translation_entries: list[JsonEntry] | None = Field(default=None, max_length=20)
    pattern: str | None = Field(default=None, max_length=2000)
    example_entries: list[JsonEntry] | None = Field(default=None, max_length=20)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    notes: str | None = Field(default=None, max_length=4000)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("countability")
    @classmethod
    def validate_countability(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if value not in COUNTABILITY_VALUES:
            allowed = ", ".join(COUNTABILITY_VALUES)
            raise ValueError(f"countability must be one of: {allowed}")
        return value

    @field_validator("part_of_speech")
    @classmethod
    def validate_part_of_speech(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if value not in PART_OF_SPEECH_VALUES:
            allowed = ", ".join(PART_OF_SPEECH_VALUES)
            raise ValueError(f"part_of_speech must be one of: {allowed}")
        return value

    @field_validator("translation_entries", "example_entries")
    @classmethod
    def clean_entries(cls, value: list[str] | None) -> list[str] | None:
        return _clean_entries(value)

    @model_validator(mode="after")
    def reject_explicit_null_translations(self) -> "AiReviewImportWord":
        if "translations" in self.model_fields_set and self.translations is None:
            raise ValueError("translations cannot be null; omit it to leave it unchanged")
        return self


class AiReviewImportRequest(BaseModel):
    schema_version: Literal["lexora.ai-review.v1"] = SCHEMA_VERSION
    topic_id: int = Field(gt=0)
    exported_at: datetime | None = None
    dry_run: bool = False
    words: list[AiReviewImportWord] = Field(min_length=1, max_length=100)

    model_config = ConfigDict(extra="ignore")


class AiReviewImportResponse(BaseModel):
    topic_id: int
    topic_name: str
    dry_run: bool
    updated: int
    unchanged: int
    updated_word_ids: list[int]
