from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.features.words.constants import WORD_TERM_MAX_LEN


class ConfusableOut(BaseModel):
    value: str
    explanation: str | None = None


class VerbFormOut(BaseModel):
    past_simple: str | None = None
    past_participle: str | None = None
    present_participle: str | None = None
    third_person: str | None = None


class EnrichRequest(BaseModel):
    term: str = Field(min_length=1, max_length=WORD_TERM_MAX_LEN)
    language: str = Field(default="en", max_length=2)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class EnrichResponse(BaseModel):
    term: str
    definition: str | None = None
    pronunciation_ipa: str | None = None
    pronunciation_audio_url: str | None = None
    part_of_speech: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    countability: str | None = None
    frequency_rank: int | None = None
    pattern: str | None = None
    notes: str | None = None
    translation_entries: list[str] = Field(default_factory=list)
    example_entries: list[str] = Field(default_factory=list)
    synonym_entries: list[str] = Field(default_factory=list)
    antonym_entries: list[str] = Field(default_factory=list)
    collocation_entries: list[str] = Field(default_factory=list)
    confusable_entries: list[ConfusableOut] = Field(default_factory=list)
    verb_form: VerbFormOut | None = None
