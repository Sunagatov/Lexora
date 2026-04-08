from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.shared.constraints import (
    BULK_WORDS_MAX, KNOWLEDGE_LEVEL_MAX, KNOWLEDGE_LEVEL_MIN,
    TOPIC_NAME_MAX_LEN, WORD_COUNT_MAX_LEN, WORD_POS_MAX_LEN,
    WORD_TERM_MAX_LEN, WORD_VERB_FORM_MAX_LEN,
)


class WordCreate(BaseModel):
    topic_id: int = Field(gt=0)
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    translations: str = Field(min_length=1)
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    pattern: str | None = None
    example: str | None = None
    notes: str | None = None
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordUpdate(BaseModel):
    topic_id: int | None = Field(default=None, gt=0)
    term: str | None = Field(default=None, min_length=1, max_length=WORD_TERM_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    translations: str | None = Field(default=None, min_length=1)
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    knowledge_level: int | None = Field(default=None, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    pattern: str | None = None
    example: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordResponse(BaseModel):
    id: int
    topic_id: int
    term: str
    past_simple: str | None
    past_participle: str | None
    translations: str
    part_of_speech: str | None
    knowledge_level: int | None
    countability: str | None
    pattern: str | None
    example: str | None
    notes: str | None
    is_active: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WordInput(BaseModel):
    """Word data for bulk import — no topic_id, comes from WordBulkCreate."""
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    past_simple: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    past_participle: str | None = Field(default=None, max_length=WORD_VERB_FORM_MAX_LEN)
    translations: str = Field(min_length=1)
    part_of_speech: str | None = Field(default=None, max_length=WORD_POS_MAX_LEN)
    knowledge_level: int | None = Field(default=1, ge=KNOWLEDGE_LEVEL_MIN, le=KNOWLEDGE_LEVEL_MAX)
    countability: str | None = Field(default=None, max_length=WORD_COUNT_MAX_LEN)
    pattern: str | None = None
    example: str | None = None
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
