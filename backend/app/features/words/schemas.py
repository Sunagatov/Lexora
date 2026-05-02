from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.features.words.constants import (
    BULK_WORDS_MAX,
    CEFR_LEVELS,
    COUNTABILITY_VALUES,
    KNOWLEDGE_LEVEL_MAX,
    KNOWLEDGE_LEVEL_MIN,
    LANGUAGES,
    REGISTER_VALUES,
    ProgressSource,
    WORD_TERM_MAX_LEN,
)
from app.features.words.enrichment import (
    EXAMPLE_TARGET_COUNT,
    example_count as count_examples,
    example_enrichment_status,
    needs_example_enrichment,
)
from app.features.topics.constants import TOPIC_NAME_MAX_LEN

if TYPE_CHECKING:
    from app.features.words.model import Word


# ── Nested schemas for entry tables ──

class VerbFormData(BaseModel):
    past_simple: str | None = None
    past_participle: str | None = None
    present_participle: str | None = None
    third_person: str | None = None

    model_config = ConfigDict(extra="forbid")


class ConfusableEntry(BaseModel):
    value: str = Field(min_length=1)
    explanation: str | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ── Create ──

class WordCreate(BaseModel):
    topic_ids: list[int] = Field(min_length=1)
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    language: str = Field(default="en")
    definition: str | None = None
    pronunciation_ipa: str | None = None
    pronunciation_audio_url: str | None = None
    image_url: str | None = None
    part_of_speech: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    countability: str | None = None
    frequency_rank: int | None = Field(default=None, ge=1)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    pattern: str | None = None
    notes: str | None = None
    is_active: bool = True
    translation_entries: list[str] | None = None
    example_entries: list[str] | None = None
    synonym_entries: list[str] | None = None
    antonym_entries: list[str] | None = None
    collocation_entries: list[str] | None = None
    confusable_entries: list[ConfusableEntry] | None = None
    verb_form: VerbFormData | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ── Update ──

class WordUpdate(BaseModel):
    topic_ids: list[int] | None = Field(default=None, min_length=1)
    term: str | None = Field(default=None, min_length=1, max_length=WORD_TERM_MAX_LEN)
    language: str | None = None
    definition: str | None = None
    pronunciation_ipa: str | None = None
    pronunciation_audio_url: str | None = None
    image_url: str | None = None
    part_of_speech: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    countability: str | None = None
    frequency_rank: int | None = Field(default=None, ge=1)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    pattern: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    progress_source: ProgressSource | None = None
    translation_entries: list[str] | None = None
    example_entries: list[str] | None = None
    synonym_entries: list[str] | None = None
    antonym_entries: list[str] | None = None
    collocation_entries: list[str] | None = None
    confusable_entries: list[ConfusableEntry] | None = None
    verb_form: VerbFormData | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "WordUpdate":
        for field in ("topic_ids", "term", "is_active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit it to leave it unchanged")
        return self


# ── Response ──

class VerbFormResponse(BaseModel):
    past_simple: str | None = None
    past_participle: str | None = None
    present_participle: str | None = None
    third_person: str | None = None


class ConfusableResponse(BaseModel):
    value: str
    explanation: str | None = None


class WordResponse(BaseModel):
    id: int
    topic_ids: list[int]
    term: str
    language: str
    definition: str | None
    pronunciation_ipa: str | None
    pronunciation_audio_url: str | None
    image_url: str | None
    part_of_speech: str | None
    cefr_level: str | None
    register: str | None
    countability: str | None
    frequency_rank: int | None
    knowledge_level: int | None
    pattern: str | None
    notes: str | None
    is_active: bool
    verb_form: VerbFormResponse | None = None
    translation_entries: list[str] = Field(default_factory=list)
    example_entries: list[str] = Field(default_factory=list)
    example_count: int
    example_target_count: int
    example_status: Literal["missing", "partial", "complete"]
    needs_example_enrichment: bool
    synonym_entries: list[str] = Field(default_factory=list)
    antonym_entries: list[str] = Field(default_factory=list)
    collocation_entries: list[str] = Field(default_factory=list)
    confusable_entries: list[ConfusableResponse] = Field(default_factory=list)
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_word(cls, word: "Word") -> "WordResponse":
        ec = count_examples(word)
        vf = word.verb_form
        return cls(
            id=word.id,
            topic_ids=[t.id for t in word.topics if t.deleted_at is None],
            term=word.term,
            language=word.language,
            definition=word.definition,
            pronunciation_ipa=word.pronunciation_ipa,
            pronunciation_audio_url=word.pronunciation_audio_url,
            image_url=word.image_url,
            part_of_speech=word.part_of_speech.name if word.part_of_speech else None,
            cefr_level=word.cefr_level,
            register=word.register,
            countability=word.countability,
            frequency_rank=word.frequency_rank,
            knowledge_level=word.knowledge_level,
            pattern=word.pattern,
            notes=word.notes,
            is_active=word.is_active,
            verb_form=VerbFormResponse(
                past_simple=vf.past_simple,
                past_participle=vf.past_participle,
                present_participle=vf.present_participle,
                third_person=vf.third_person,
            ) if vf else None,
            translation_entries=[item.value for item in getattr(word, "translation_items", [])],
            example_entries=[item.value for item in getattr(word, "example_items", [])],
            example_count=ec,
            example_target_count=EXAMPLE_TARGET_COUNT,
            example_status=example_enrichment_status(ec),
            needs_example_enrichment=needs_example_enrichment(word),
            synonym_entries=[item.value for item in getattr(word, "synonym_items", [])],
            antonym_entries=[item.value for item in getattr(word, "antonym_items", [])],
            collocation_entries=[item.value for item in getattr(word, "collocation_items", [])],
            confusable_entries=[
                ConfusableResponse(value=item.value, explanation=item.explanation)
                for item in getattr(word, "confusable_items", [])
            ],
            deleted_at=word.deleted_at,
            created_at=word.created_at,
            updated_at=word.updated_at,
        )


# ── Bulk import ──

class WordInput(BaseModel):
    """Word data for bulk import — no topic_id, comes from WordBulkCreate."""
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    language: str = Field(default="en")
    definition: str | None = None
    pronunciation_ipa: str | None = None
    part_of_speech: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    countability: str | None = None
    frequency_rank: int | None = Field(default=None, ge=1)
    knowledge_level: int | None = Field(default=1, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    pattern: str | None = None
    notes: str | None = None
    translation_entries: list[str] | None = None
    example_entries: list[str] | None = None
    verb_form: VerbFormData | None = None

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


class WordListResponse(BaseModel):
    words: list[WordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BatchUpdateRequest(BaseModel):
    word_ids: list[int] = Field(min_length=1)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    add_topic_ids: list[int] | None = None
    remove_topic_ids: list[int] | None = None

    model_config = ConfigDict(extra="forbid")


class BatchUpdateResponse(BaseModel):
    updated: int


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
