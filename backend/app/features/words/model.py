from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.db import Base
from app.shared.constraints import (
    WORD_TERM_MAX_LEN, WORD_VERB_FORM_MAX_LEN, WORD_POS_MAX_LEN, WORD_COUNT_MAX_LEN,
)

word_topics = Table(
    "word_topics",
    Base.metadata,
    Column("word_id", Integer, ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    term: Mapped[str] = mapped_column(String(WORD_TERM_MAX_LEN), index=True)
    past_simple: Mapped[str | None] = mapped_column(String(WORD_VERB_FORM_MAX_LEN), nullable=True)
    past_participle: Mapped[str | None] = mapped_column(String(WORD_VERB_FORM_MAX_LEN), nullable=True)
    translations: Mapped[str] = mapped_column(Text())
    part_of_speech: Mapped[str | None] = mapped_column(String(WORD_POS_MAX_LEN), nullable=True)
    knowledge_level: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    countability: Mapped[str | None] = mapped_column(String(WORD_COUNT_MAX_LEN), nullable=True)
    pattern: Mapped[str | None] = mapped_column(Text(), nullable=True)
    example: Mapped[str | None] = mapped_column(Text(), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    topics = relationship("Topic", secondary=word_topics, back_populates="words")
    progress_events = relationship("WordProgressEvent", back_populates="word", cascade="all, delete-orphan")
