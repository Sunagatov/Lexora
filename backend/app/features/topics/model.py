from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.db import Base
from app.shared.constraints import TOPIC_NAME_MAX_LEN, TOPIC_SLUG_MAX_LEN
from app.features.words.model import word_topics

if TYPE_CHECKING:
    from app.features.words.model import Word


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(TOPIC_NAME_MAX_LEN), index=True)
    slug: Mapped[str] = mapped_column(String(TOPIC_SLUG_MAX_LEN), unique=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    words: Mapped[list[Word]] = relationship("Word", secondary=word_topics, back_populates="topics")
