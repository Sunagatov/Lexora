from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.features.words.ai_curation.schema_support import PaginationMeta, SCHEMA_VERSION


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
    cefr_level: list[str]
    register: list[str]
    language: list[str]


class AiCurationWord(BaseModel):
    id: int
    topic_ids: list[int]
    term: str
    language: str
    definition: str | None
    translation_entries: list[str]
    pattern: str | None
    example_entries: list[str]
    example_count: int
    example_target_count: int
    example_status: Literal["missing", "partial", "complete"]
    needs_example_enrichment: bool
    countability: str | None
    part_of_speech: str | None
    cefr_level: str | None
    register: str | None
    frequency_rank: int | None
    verb_form: dict | None
    synonym_entries: list[str]
    antonym_entries: list[str]
    collocation_entries: list[str]
    confusable_entries: list[dict]
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
    example_entries: list[str] | None = None
    example_count: int
    example_target_count: int
    example_status: Literal["missing", "partial", "complete"]
    needs_example_enrichment: bool


class AiCurationTopicWordsLeanResponse(BaseModel):
    schema_version: Literal["lexora.ai-curation.v2"] = SCHEMA_VERSION
    source_topic_id: int
    exported_at: datetime
    total_words: int
    words: list[AiCurationWordLean]
