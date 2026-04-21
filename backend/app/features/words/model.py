from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.db import Base
from app.shared.constraints import (
    WORD_TERM_MAX_LEN, WORD_VERB_FORM_MAX_LEN, WORD_POS_MAX_LEN, WORD_COUNT_MAX_LEN,
)

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.topics.model import Topic

word_topics = Table(
    "word_topics",
    Base.metadata,
    Column("word_id", Integer, ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class WordTranslation(Base):
    __tablename__ = "word_translations"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_translations_word_id_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    word = relationship("Word", back_populates="translation_items")


class WordExample(Base):
    __tablename__ = "word_examples"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_examples_word_id_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    word = relationship("Word", back_populates="example_items")


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
    deleted_via_topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    topics: Mapped[list[Topic]] = relationship("Topic", secondary=word_topics, back_populates="words")
    translation_items: Mapped[list[WordTranslation]] = relationship(
        "WordTranslation",
        back_populates="word",
        cascade="all, delete-orphan",
        order_by="WordTranslation.position",
    )
    example_items: Mapped[list[WordExample]] = relationship(
        "WordExample",
        back_populates="word",
        cascade="all, delete-orphan",
        order_by="WordExample.position",
    )
    progress_events = relationship("WordProgressEvent", back_populates="word", cascade="all, delete-orphan")
