from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TopicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: str | None = None
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TopicResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    is_active: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
