from __future__ import annotations

from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

from app.features.words.workbook.format import COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES
from app.shared.constraints import (
    KNOWLEDGE_LEVEL_MAX,
    KNOWLEDGE_LEVEL_MIN,
    TOPIC_NAME_MAX_LEN,
    WORD_COUNT_MAX_LEN,
    WORD_POS_MAX_LEN,
    WORD_TERM_MAX_LEN,
    WORD_VERB_FORM_MAX_LEN,
)

SCHEMA_VERSION = "lexora.ai-curation.v2"
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


class AiCurationTopicSummary(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    is_active: bool
    word_count: int


class AiCurationTopicListResponse(BaseModel):
    items: list[AiCurationTopicSummary]
    pagination: PaginationMeta


class AiCurationAllowedValues(BaseModel):
    countability: list[str]
    part_of_speech: list[str]


class AiCurationWord(BaseModel):
    id: int
    topic_ids: list[int]
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
    is_active: bool


class AiCurationTopicWordsResponse(BaseModel):
    schema_version: Literal["lexora.ai-curation.v2"] = SCHEMA_VERSION
    exported_at: datetime
    source_topic: AiCurationTopicSummary
    pagination: PaginationMeta
    allowed_values: AiCurationAllowedValues
    instructions: list[str]
    words: list[AiCurationWord]


class AiCurationWordLean(BaseModel):
    id: int
    term: str
    example_entries: list[str]


class AiCurationTopicWordsLeanResponse(BaseModel):
    """Minimal export for ChatGPT examples enrichment — id, term, existing examples only."""
    schema_version: Literal["lexora.ai-curation.v2"] = SCHEMA_VERSION
    source_topic_id: int
    exported_at: datetime
    total_words: int
    words: list[AiCurationWordLean]


# ── Import: topic operations ──────────────────────────────────────────────────

class TopicRef(BaseModel):
    topic_id: int | None = Field(default=None, gt=0)
    client_key: str | None = Field(default=None, min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_exactly_one(self) -> "TopicRef":
        if (self.topic_id is None) == (self.client_key is None):
            raise ValueError("Exactly one of topic_id or client_key must be provided")
        return self


class CreateTopicOperation(BaseModel):
    op: Literal["create_topic"] = "create_topic"
    client_key: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=TOPIC_NAME_MAX_LEN)
    description: str | None = None
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ── Import: word operations (v2) ──────────────────────────────────────────────

class WordUpdateV2(BaseModel):
    """Sparse update — only id is required, include only the fields to change."""
    id: int = Field(gt=0)

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
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("translation_entries", "example_entries")
    @classmethod
    def clean_entries(cls, value: list[str] | None) -> list[str] | None:
        return _clean_entries(value)

    @field_validator("countability")
    @classmethod
    def validate_countability(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if value not in COUNTABILITY_VALUES:
            raise ValueError(f"countability must be one of: {', '.join(COUNTABILITY_VALUES)}")
        return value

    @field_validator("part_of_speech")
    @classmethod
    def validate_pos(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if value not in PART_OF_SPEECH_VALUES:
            raise ValueError(f"part_of_speech must be one of: {', '.join(PART_OF_SPEECH_VALUES)}")
        return value


class WordCreateV2(BaseModel):
    """Full word creation — include term, translations, and all applicable fields."""
    target_topic_refs: list[TopicRef] = Field(min_length=1, max_length=20)
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    translations: str = Field(min_length=1)

    translation_entries: list[JsonEntry] | None = Field(default=None, max_length=20)
    pattern: str | None = Field(default=None, max_length=2000)
    example_entries: list[JsonEntry] | None = Field(default=None, max_length=20)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    notes: str | None = Field(default=None, max_length=4000)
    knowledge_level: int | None = Field(default=1, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("translation_entries", "example_entries")
    @classmethod
    def clean_entries(cls, value: list[str] | None) -> list[str] | None:
        return _clean_entries(value)

    @field_validator("countability")
    @classmethod
    def validate_countability(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if value not in COUNTABILITY_VALUES:
            raise ValueError(f"countability must be one of: {', '.join(COUNTABILITY_VALUES)}")
        return value

    @field_validator("part_of_speech")
    @classmethod
    def validate_pos(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if value not in PART_OF_SPEECH_VALUES:
            raise ValueError(f"part_of_speech must be one of: {', '.join(PART_OF_SPEECH_VALUES)}")
        return value


class WordReassignV2(BaseModel):
    """Reassign an existing word to different topics."""
    id: int = Field(gt=0)
    add_topic_refs: list[TopicRef] = Field(default_factory=list, max_length=20)
    remove_topic_ids: list[int] = Field(default_factory=list, max_length=20)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ── Import request / response ─────────────────────────────────────────────────

class AiCurationImportRequest(BaseModel):
    schema_version: Literal["lexora.ai-curation.v2"] = SCHEMA_VERSION
    source_topic_id: int = Field(gt=0)
    dry_run: bool = False
    strict_mode: bool = False
    exported_at: datetime | None = None
    topic_operations: list[CreateTopicOperation] = Field(default_factory=list, max_length=50)
    word_updates: list[WordUpdateV2] = Field(default_factory=list, max_length=500)
    word_creates: list[WordCreateV2] = Field(default_factory=list, max_length=500)
    word_reassigns: list[WordReassignV2] = Field(default_factory=list, max_length=500)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_not_empty(self) -> "AiCurationImportRequest":
        if not self.topic_operations and not self.word_updates and not self.word_creates and not self.word_reassigns:
            raise ValueError("At least one operation must be provided")
        return self


class CreatedTopicResult(BaseModel):
    client_key: str
    id: int
    name: str
    slug: str


class AiCurationImportResponse(BaseModel):
    source_topic_id: int
    source_topic_name: str
    dry_run: bool
    created_topics: list[CreatedTopicResult]
    created_words: int
    updated_words: int
    reassigned_words: int
    unchanged: int
    created_word_ids: list[int]
    updated_word_ids: list[int]
    reassigned_word_ids: list[int]
