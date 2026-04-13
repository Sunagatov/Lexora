from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.shared.constraints import TOPIC_NAME_MAX_LEN, TOPIC_SLUG_MAX_LEN


class TopicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=TOPIC_NAME_MAX_LEN)
    description: str | None = None
    is_active: bool = True

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=TOPIC_NAME_MAX_LEN)
    slug: str | None = Field(default=None, min_length=1, max_length=TOPIC_SLUG_MAX_LEN)
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
