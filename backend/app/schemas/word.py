from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WordBase(BaseModel):
    topic_id: int = Field(gt=0)
    term: str = Field(min_length=1, max_length=255)
    translations: str = Field(min_length=1)
    part_of_speech: str | None = Field(default=None, max_length=50)
    knowledge_level: int | None = Field(default=None, ge=1, le=5)
    countability: str | None = Field(default=None, max_length=50)
    pattern: str | None = None
    example: str | None = None
    notes: str | None = None
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordCreate(WordBase):
    pass


class WordUpdate(BaseModel):
    topic_id: int | None = Field(default=None, gt=0)
    term: str | None = Field(default=None, min_length=1, max_length=255)
    translations: str | None = Field(default=None, min_length=1)
    part_of_speech: str | None = Field(default=None, max_length=50)
    knowledge_level: int | None = Field(default=None, ge=1, le=5)
    countability: str | None = Field(default=None, max_length=50)
    pattern: str | None = None
    example: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WordResponse(WordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)