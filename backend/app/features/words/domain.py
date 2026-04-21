from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.text import normalize_term
from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.exceptions import DuplicateWordInTopicError


def existing_normalized_terms(
    db: Session,
    topic_ids: list[int],
    exclude_word_id: int | None = None,
) -> set[str]:
    """Return normalized terms of active words in the given topics, optionally excluding one word id."""
    stmt = (
        select(Word.term)
        .where(Word.deleted_at.is_(None))
        .where(Word.topics.any(Topic.id.in_(topic_ids)))
    )
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
        ),
    )
