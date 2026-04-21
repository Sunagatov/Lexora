from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.words.schemas import WordResponse


class StudyQueueItemResponse(BaseModel):
    id: int
    word_id: int
    position: int
    is_completed: bool
    completed_at: datetime | None
    word: WordResponse

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_item(cls, item: StudyQueueItem) -> "StudyQueueItemResponse":
        return cls(
            id=item.id,
            word_id=item.word_id,
            position=item.position,
            is_completed=item.is_completed,
            completed_at=item.completed_at,
            word=WordResponse.from_word(item.word),
        )


class StudyQueueResponse(BaseModel):
    id: int
    generated_at: datetime
    expires_at: datetime
    is_active: bool
    total_count: int
    completed_count: int
    items: list[StudyQueueItemResponse]

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_queue(cls, queue: StudyQueue) -> "StudyQueueResponse":
        return cls(
            id=queue.id,
            generated_at=queue.generated_at,
            expires_at=queue.expires_at,
            is_active=queue.is_active,
            total_count=queue.total_count,
            completed_count=queue.completed_count,
            items=[StudyQueueItemResponse.from_item(i) for i in queue.items],
        )
