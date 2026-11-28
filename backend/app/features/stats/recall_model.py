from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


class RecallAttempt(Base):
    __tablename__ = "lexora_recall_attempts"
    __table_args__ = (
        Index("ix_lexora_recall_attempts_word_target_time", "word_id", "translation_language", "occurred_at"),
        Index("ix_lexora_recall_attempts_scope_time", "language", "translation_language", "occurred_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    word_id: Mapped[int] = mapped_column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False)
    language: Mapped[str] = mapped_column(String(2), nullable=False)
    translation_language: Mapped[str] = mapped_column(String(2), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recalled: Mapped[bool] = mapped_column(Boolean, nullable=False)
