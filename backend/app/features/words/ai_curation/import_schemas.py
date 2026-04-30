from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.features.words.ai_curation.schema_support import (
    COMMON_MODEL_CONFIG,
    COUNTABILITY_ALLOWED_VALUES,
    JsonEntry,
    PART_OF_SPEECH_ALLOWED_VALUES,
    SCHEMA_VERSION,
    _clean_entries,
    _json_entry_field,
    _normalize_optional_choice,
)
from app.shared.constraints import (
    KNOWLEDGE_LEVEL_MAX,
    KNOWLEDGE_LEVEL_MIN,
    TOPIC_NAME_MAX_LEN,
    WORD_COUNT_MAX_LEN,
    WORD_POS_MAX_LEN,
    WORD_TERM_MAX_LEN,
    WORD_VERB_FORM_MAX_LEN,
)

JsonEntryField = Annotated[JsonEntry, _json_entry_field()]


class TopicRef(BaseModel):
    topic_id: int | None = Field(default=None, gt=0)
    client_key: str | None = Field(default=None, min_length=1, max_length=100)

    model_config = COMMON_MODEL_CONFIG

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
    parent_topic_id: int | None = Field(default=None, gt=0)
    is_active: bool = True

    model_config = COMMON_MODEL_CONFIG


class _WordPayloadBase(BaseModel):
    translations: str | None = Field(default=None, min_length=1)
    translation_entries: list[JsonEntryField] | None = Field(default=None, max_length=20)
    pattern: str | None = Field(default=None, max_length=2000)
    example_entries: list[JsonEntryField] | None = Field(default=None, max_length=20)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    notes: str | None = Field(default=None, max_length=4000)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)

    model_config = COMMON_MODEL_CONFIG

    @field_validator("translation_entries", "example_entries")
    @classmethod
    def clean_entries(cls, value: list[str] | None) -> list[str] | None:
        return _clean_entries(value)

    @field_validator("countability")
    @classmethod
    def validate_countability(cls, value: str | None) -> str | None:
        return _normalize_optional_choice(value, COUNTABILITY_ALLOWED_VALUES, "countability")

    @field_validator("part_of_speech")
    @classmethod
    def validate_part_of_speech(cls, value: str | None) -> str | None:
        return _normalize_optional_choice(value, PART_OF_SPEECH_ALLOWED_VALUES, "part_of_speech")


class WordUpdateV2(_WordPayloadBase):
    id: int = Field(gt=0)
    term: str | None = Field(default=None, max_length=WORD_TERM_MAX_LEN)
    is_active: bool | None = None

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "WordUpdateV2":
        for field in ("term", "translations", "is_active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit it to leave it unchanged")
        return self


class WordCreateV2(_WordPayloadBase):
    target_topic_refs: list[TopicRef] = Field(min_length=1, max_length=20)
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    translations: str = Field(min_length=1)
    knowledge_level: int | None = Field(default=1, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    is_active: bool = True


class WordReassignV2(BaseModel):
    id: int = Field(gt=0)
    term: str | None = Field(default=None, max_length=WORD_TERM_MAX_LEN)
    add_topic_refs: list[TopicRef] = Field(default_factory=list, max_length=20)
    remove_topic_ids: list[int] = Field(default_factory=list, max_length=20)

    model_config = COMMON_MODEL_CONFIG


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
    word_operations: list[dict[str, Any]] | None = Field(default=None, exclude=True)

    model_config = COMMON_MODEL_CONFIG

    @model_validator(mode="after")
    def validate_not_empty(self) -> "AiCurationImportRequest":
        _expand_legacy_word_operations(self)
        if (
            not self.topic_operations
            and not self.word_updates
            and not self.word_creates
            and not self.word_reassigns
        ):
            raise ValueError("At least one operation must be provided")
        return self


class CreatedTopicResult(BaseModel):
    client_key: str
    id: int | None = None
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


def _expand_legacy_word_operations(payload: AiCurationImportRequest) -> None:
    if not payload.word_operations:
        return
    for raw in payload.word_operations:
        op = raw.get("op")
        data = {key: value for key, value in raw.items() if key != "op"}
        if op == "create_new_word":
            payload.word_creates.append(WordCreateV2.model_validate(data))
        elif op == "update_existing_word":
            payload.word_updates.append(WordUpdateV2.model_validate(data))
        elif op == "reassign_word_topics":
            payload.word_reassigns.append(WordReassignV2.model_validate(data))
        else:
            raise ValueError(f"Unsupported legacy word operation: {op}")
    payload.word_operations = None
