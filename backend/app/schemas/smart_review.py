from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.word import WordResponse


class StudyQueueItemResponse(BaseModel):
    id: int
    word_id: int
    position: int
    is_completed: bool
    completed_at: datetime | None
    word: WordResponse

    model_config = ConfigDict(from_attributes=True)


class StudyQueueResponse(BaseModel):
    id: int
    generated_at: datetime
    expires_at: datetime
    is_active: bool
    total_count: int
    completed_count: int
    items: list[StudyQueueItemResponse]

    model_config = ConfigDict(from_attributes=True)
