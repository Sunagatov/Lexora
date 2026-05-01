from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.features.words.constants import PROGRESS_SOURCE_MANUAL, ProgressSource
from app.shared.db import Base


class WordProgressEvent(Base):
    __tablename__ = "word_progress_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(Integer(), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    old_level: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    new_level: Mapped[int] = mapped_column(Integer(), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default=PROGRESS_SOURCE_MANUAL)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    word = relationship("Word", back_populates="progress_events")


def record_level_change(
    db,
    word_id: int,
    old_level: int | None,
    new_level: int,
    source: ProgressSource,
) -> None:
    """Append a word-owned progress event without committing the transaction."""
    db.add(WordProgressEvent(word_id=word_id, old_level=old_level, new_level=new_level, source=source))
