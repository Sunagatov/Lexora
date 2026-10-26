from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.model import Word
from app.shared.text import normalize_term


def lock_word_identities(db: Session) -> None:
    """Coordinate new identities with reviewed workbook imports on PostgreSQL."""
    if isinstance(db, Session) and db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(1279611471)"))


def existing_normalized_terms(
    db: Session,
    topic_ids: list[int] | None = None,
    exclude_word_id: int | None = None,
    *,
    identity: tuple[str, int | None] | None = None,
) -> set[str]:
    """Return stored spellings, optionally restricted to a language/part of speech."""
    del topic_ids

    stmt = select(Word.term)
    if identity is not None:
        language, pos_id = identity
        stmt = stmt.where(Word.language == language, Word.part_of_speech_id == pos_id)
    if exclude_word_id is not None:
        stmt = stmt.where(Word.id != exclude_word_id)
    return {normalize_term(t) for t in db.scalars(stmt).all()}


def assert_no_duplicate_word(term: str, existing: set[str]) -> None:
    """Raise DuplicateWordInTopicError if the normalized term is already in the existing set."""
    if normalize_term(term) in existing:
        raise DuplicateWordInTopicError(term)


def assert_word_restore_allowed(
    db: Session,
    word: Word,
    restoring_topic_ids: set[int] | None = None,
) -> None:
    topic_ids = {topic.id for topic in word.topics if topic.deleted_at is None}
    if restoring_topic_ids:
        topic_ids |= restoring_topic_ids

    if not topic_ids:
        return

    assert_no_duplicate_word(
        word.term,
        existing_normalized_terms(
            db,
            sorted(topic_ids),
            exclude_word_id=word.id,
            identity=(getattr(word, "language", "en"), word.part_of_speech_id) if getattr(word, "part_of_speech_id", None) is not None else None,
        ),
    )
