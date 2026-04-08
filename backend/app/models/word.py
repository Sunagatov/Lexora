from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    term: Mapped[str] = mapped_column(String(255), index=True)
    past_simple: Mapped[str | None] = mapped_column(String(255), nullable=True)
    past_participle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    translations: Mapped[str] = mapped_column(Text())
    part_of_speech: Mapped[str | None] = mapped_column(String(50), nullable=True)
    knowledge_level: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    countability: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pattern: Mapped[str | None] = mapped_column(Text(), nullable=True)
    example: Mapped[str | None] = mapped_column(Text(), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    topic = relationship("Topic", back_populates="words")