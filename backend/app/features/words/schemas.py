from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.features.words.constants import ProgressSource
from app.features.words.enrichment import (
    EXAMPLE_TARGET_COUNT,
    example_count as count_examples,
    example_enrichment_status,
    needs_example_enrichment,
)

if TYPE_CHECKING:
    from app.features.words.model import Word

from app.shared.constraints import (
    BULK_WORDS_MAX, KNOWLEDGE_LEVEL_MAX, KNOWLEDGE_LEVEL_MIN,
    TOPIC_NAME_MAX_LEN, WORD_COUNT_MAX_LEN, WORD_POS_MAX_LEN,
    WORD_TERM_MAX_LEN, WORD_VERB_FORM_MAX_LEN,
)


class WordCreate(BaseModel):
    topic_ids: list[int] = Field(min_length=1)
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    translations: str = Field(min_length=1)
    translation_entries: list[str] | None = None
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    pattern: str | None = None
    example: str | None = None
    example_entries: list[str] | None = None
    notes: str | None = None
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordUpdate(BaseModel):
    topic_ids: list[int] | None = Field(default=None, min_length=1)
    term: str | None = Field(default=None, min_length=1, max_length=WORD_TERM_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    translations: str | None = Field(default=None, min_length=1)
    translation_entries: list[str] | None = None
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    pattern: str | None = None
    example: str | None = None
    example_entries: list[str] | None = None
    notes: str | None = None
    is_active: bool | None = None
    progress_source: ProgressSource | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "WordUpdate":
        for field in ("topic_ids", "term", "translations", "is_active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit it to leave it unchanged")
        return self


class WordResponse(BaseModel):
    id: int
    topic_ids: list[int]
    term: str
    past_simple: str | None
    past_participle: str | None
    translations: str
    translation_entries: list[str] = Field(default_factory=list)
    part_of_speech: str | None
    knowledge_level: int | None
    countability: str | None
    pattern: str | None
    example: str | None
    example_entries: list[str] = Field(default_factory=list)
    example_count: int
    example_target_count: int
    example_status: Literal["missing", "partial", "complete"]
    needs_example_enrichment: bool
    notes: str | None
    is_active: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_word(cls, word: "Word") -> "WordResponse":
        example_count = count_examples(word)
        return cls(
            id=word.id,
            topic_ids=[t.id for t in word.topics if t.deleted_at is None],
            term=word.term,
            past_simple=word.past_simple,
            past_participle=word.past_participle,
            translations=word.translations,
            translation_entries=[item.value for item in getattr(word, "translation_items", [])],
            part_of_speech=word.part_of_speech,
            knowledge_level=word.knowledge_level,
            countability=word.countability,
            pattern=word.pattern,
            example=word.example,
            example_entries=[item.value for item in getattr(word, "example_items", [])],
            example_count=example_count,
            example_target_count=EXAMPLE_TARGET_COUNT,
            example_status=example_enrichment_status(example_count),
            needs_example_enrichment=needs_example_enrichment(word),
            notes=word.notes,
            is_active=word.is_active,
            deleted_at=word.deleted_at,
            created_at=word.created_at,
            updated_at=word.updated_at,
        )


class WordInput(BaseModel):
    """Word data for bulk import — no topic_id, comes from WordBulkCreate."""
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    translations: str = Field(min_length=1)
    translation_entries: list[str] | None = None
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    knowledge_level: int | None = Field(default=1, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    pattern: str | None = None
    example: str | None = None
    example_entries: list[str] | None = None
    notes: str | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordBulkCreate(BaseModel):
    topic_name: str = Field(min_length=1, max_length=TOPIC_NAME_MAX_LEN)
    words: list[WordInput] = Field(min_length=1, max_length=BULK_WORDS_MAX)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class BulkImportResponse(BaseModel):
    topic_id: int
    topic_name: str
    added: int
    skipped: int
    added_terms: list[str]
    skipped_terms: list[str]


class WorkbookImportSheetSummary(BaseModel):
    sheet_name: str
    topic_name: str
    created: int
    updated: int
    skipped: int = 0


class WorkbookImportResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    sheets: list[WorkbookImportSheetSummary]
