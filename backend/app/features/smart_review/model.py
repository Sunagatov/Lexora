from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.db import Base

if TYPE_CHECKING:
    from app.features.words.model import Word


class StudyQueue(Base):
    __tablename__ = "study_queues"

    id: Mapped[int] = mapped_column(primary_key=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, nullable=False)
    total_count: Mapped[int] = mapped_column(Integer(), nullable=False)
    completed_count: Mapped[int] = mapped_column(Integer(), default=0, nullable=False)

    items: Mapped[list[StudyQueueItem]] = relationship(
        "StudyQueueItem", back_populates="queue", cascade="all, delete-orphan", order_by="StudyQueueItem.position"
    )

class StudyQueueItem(Base):
    __tablename__ = "study_queue_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    queue_id: Mapped[int] = mapped_column(ForeignKey("study_queues.id", ondelete="CASCADE"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean(), default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    queue: Mapped[StudyQueue] = relationship("StudyQueue", back_populates="items")
    word: Mapped[Word] = relationship("Word")
