from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.db import Base


class WordProgressEvent(Base):
    __tablename__ = "word_progress_events"

    id:         Mapped[int]        = mapped_column(primary_key=True)
    word_id:    Mapped[int]        = mapped_column(Integer(), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    old_level:  Mapped[int | None] = mapped_column(Integer(), nullable=True)
    new_level:  Mapped[int]        = mapped_column(Integer(), nullable=False)
    # "manual" | "smart_review" | "quick_add" | "bulk_import"
    source:     Mapped[str]        = mapped_column(String(32), nullable=False, default="manual")
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    word = relationship("Word", back_populates="progress_events")


class AppUsageEvent(Base):
    __tablename__ = "app_usage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    session_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    route: Mapped[str | None] = mapped_column(String(128), nullable=True)
    active_seconds: Mapped[int] = mapped_column(Integer(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
