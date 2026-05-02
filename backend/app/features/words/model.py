from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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

from app.features.words.constants import WORD_TERM_MAX_LEN
from app.shared.db import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.topics.model import Topic

word_topics = Table(
    "word_topics",
    Base.metadata,
    Column("word_id", Integer, ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class PartsOfSpeech(Base):
    __tablename__ = "parts_of_speech"
    __table_args__ = (UniqueConstraint("name", name="uq_parts_of_speech_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)


class WordTranslation(Base):
    __tablename__ = "word_translations"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_translations_word_id_position"),
        CheckConstraint("position >= 0", name="ck_word_translations_position"),
        CheckConstraint("value != ''", name="ck_word_translations_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)

    word = relationship("Word", back_populates="translation_items")


class WordExample(Base):
    __tablename__ = "word_examples"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_examples_word_id_position"),
        CheckConstraint("position >= 0", name="ck_word_examples_position"),
        CheckConstraint("value != ''", name="ck_word_examples_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)

    word = relationship("Word", back_populates="example_items")


class WordVerbForm(Base):
    __tablename__ = "word_verb_forms"

    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), primary_key=True)
    past_simple: Mapped[str | None] = mapped_column(String(255), nullable=True)
    past_participle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    present_participle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    third_person: Mapped[str | None] = mapped_column(String(255), nullable=True)

    word = relationship("Word", back_populates="verb_form")


class WordSynonym(Base):
    __tablename__ = "word_synonyms"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_synonyms_word_id_position"),
        UniqueConstraint("word_id", "value", name="uq_word_synonyms_word_id_value"),
        CheckConstraint("position >= 0", name="ck_word_synonyms_position"),
        CheckConstraint("value != ''", name="ck_word_synonyms_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)
    target_word_id: Mapped[int | None] = mapped_column(
        ForeignKey("words.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    word = relationship("Word", foreign_keys=[word_id], back_populates="synonym_items")


class WordAntonym(Base):
    __tablename__ = "word_antonyms"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_antonyms_word_id_position"),
        UniqueConstraint("word_id", "value", name="uq_word_antonyms_word_id_value"),
        CheckConstraint("position >= 0", name="ck_word_antonyms_position"),
        CheckConstraint("value != ''", name="ck_word_antonyms_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)
    target_word_id: Mapped[int | None] = mapped_column(
        ForeignKey("words.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    word = relationship("Word", foreign_keys=[word_id], back_populates="antonym_items")


class WordCollocation(Base):
    __tablename__ = "word_collocations"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_collocations_word_id_position"),
        UniqueConstraint("word_id", "value", name="uq_word_collocations_word_id_value"),
        CheckConstraint("position >= 0", name="ck_word_collocations_position"),
        CheckConstraint("value != ''", name="ck_word_collocations_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)

    word = relationship("Word", back_populates="collocation_items")


class WordConfusable(Base):
    __tablename__ = "word_confusables"
    __table_args__ = (
        UniqueConstraint("word_id", "position", name="uq_word_confusables_word_id_position"),
        UniqueConstraint("word_id", "value", name="uq_word_confusables_word_id_value"),
        CheckConstraint("position >= 0", name="ck_word_confusables_position"),
        CheckConstraint("value != ''", name="ck_word_confusables_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer(), nullable=False)
    value: Mapped[str] = mapped_column(Text(), nullable=False)
    target_word_id: Mapped[int | None] = mapped_column(
        ForeignKey("words.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    explanation: Mapped[str | None] = mapped_column(Text(), nullable=True)

    word = relationship("Word", foreign_keys=[word_id], back_populates="confusable_items")


class Word(Base):
    __tablename__ = "words"
    __table_args__ = (
        UniqueConstraint("term", "part_of_speech_id", "language", name="uq_words_term_pos_lang"),
        CheckConstraint("language IN ('en', 'ru')", name="ck_words_language"),
        CheckConstraint("cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')", name="ck_words_cefr_level"),
        CheckConstraint("register IN ('formal', 'informal', 'neutral', 'slang', 'technical')", name="ck_words_register"),
        CheckConstraint("countability IN ('countable', 'uncountable', 'both', 'plural', 'collective')", name="ck_words_countability"),
        CheckConstraint("knowledge_level BETWEEN 1 AND 5", name="ck_words_knowledge_level"),
        CheckConstraint("frequency_rank >= 1", name="ck_words_frequency_rank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    term: Mapped[str] = mapped_column(String(WORD_TERM_MAX_LEN), index=True)
    language: Mapped[str] = mapped_column(String(2), nullable=False, server_default=text("'en'"))
    definition: Mapped[str | None] = mapped_column(Text(), nullable=True)
    pronunciation_ipa: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pronunciation_audio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    part_of_speech_id: Mapped[int | None] = mapped_column(ForeignKey("parts_of_speech.id"), nullable=True)
    cefr_level: Mapped[str | None] = mapped_column(String(2), nullable=True)
    register: Mapped[str | None] = mapped_column(String(20), nullable=True)
    countability: Mapped[str | None] = mapped_column(String(20), nullable=True)
    frequency_rank: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    knowledge_level: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    pattern: Mapped[str | None] = mapped_column(Text(), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_via_topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    part_of_speech: Mapped[PartsOfSpeech | None] = relationship("PartsOfSpeech", lazy="joined")
    topics: Mapped[list[Topic]] = relationship("Topic", secondary=word_topics, back_populates="words")
    verb_form: Mapped[WordVerbForm | None] = relationship(
        "WordVerbForm", back_populates="word", uselist=False, cascade="all, delete-orphan",
    )
    translation_items: Mapped[list[WordTranslation]] = relationship(
        "WordTranslation", back_populates="word", cascade="all, delete-orphan", order_by="WordTranslation.position",
    )
    example_items: Mapped[list[WordExample]] = relationship(
        "WordExample", back_populates="word", cascade="all, delete-orphan", order_by="WordExample.position",
    )
    synonym_items: Mapped[list[WordSynonym]] = relationship(
        "WordSynonym", back_populates="word", cascade="all, delete-orphan",
        order_by="WordSynonym.position", foreign_keys="[WordSynonym.word_id]",
    )
    antonym_items: Mapped[list[WordAntonym]] = relationship(
        "WordAntonym", back_populates="word", cascade="all, delete-orphan",
        order_by="WordAntonym.position", foreign_keys="[WordAntonym.word_id]",
    )
    collocation_items: Mapped[list[WordCollocation]] = relationship(
        "WordCollocation", back_populates="word", cascade="all, delete-orphan", order_by="WordCollocation.position",
    )
    confusable_items: Mapped[list[WordConfusable]] = relationship(
        "WordConfusable", back_populates="word", cascade="all, delete-orphan",
        order_by="WordConfusable.position", foreign_keys="[WordConfusable.word_id]",
    )
    progress_events = relationship("WordProgressEvent", back_populates="word", cascade="all, delete-orphan")


# Register word progress ORM models so Word.progress_events resolves even in isolated imports.
from app.features.words.progress import WordProgressEvent  # noqa: F401,E402
