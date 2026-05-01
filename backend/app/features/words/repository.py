from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.stats.service import record_level_change
from app.features.topics.api import get_active_subtree_topic_ids
from app.features.words.domain import (
    assert_no_duplicate_word as assert_no_duplicate_word,
    existing_normalized_terms as existing_normalized_terms,
)
from app.features.words.model import Word
from app.features.words.repository_mutations import (
    create_word_record,
    hard_delete_word_record,
    restore_word_record,
    soft_delete_word_record,
    update_word_record,
)
from app.features.words.repository_queries import (
    active_words_stmt,
    apply_word_search,
    ordered_word_stmt,
    with_word_details,
    words_for_topics_stmt,
)
from app.features.words.schemas import WordCreate, WordUpdate


def _with_details(stmt):
    return with_word_details(stmt)


def sync_word_multivalue_fields(
    word: Word,
    translations_text: str | None,
    translation_entries: list[str] | None,
    example_text: str | None,
    example_entries: list[str] | None,
) -> None:
    from app.features.words.multivalue import sync_word_multivalue_fields as _sync_word_multivalue_fields

    _sync_word_multivalue_fields(
        word,
        translations_text,
        translation_entries,
        example_text,
        example_entries,
    )


def get_all_words(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
    stmt = active_words_stmt()
    if topic_id is not None:
        topic_ids = get_active_subtree_topic_ids(db, topic_id)
        stmt = words_for_topics_stmt(topic_ids)
    if search:
        stmt = apply_word_search(stmt, search)
    stmt = ordered_word_stmt(stmt)
    return list(db.scalars(stmt).all())


def get_word_by_id(db: Session, word_id: int) -> Word | None:
    return db.scalar(with_word_details(select(Word).where(Word.id == word_id).where(Word.deleted_at.is_(None))))


def get_word_by_id_including_deleted(db: Session, word_id: int) -> Word | None:
    return db.scalar(with_word_details(select(Word).where(Word.id == word_id)))


def get_deleted_words(db: Session) -> list[Word]:
    return list(db.scalars(
        with_word_details(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc()))
    ).all())


def create_word(db: Session, payload: WordCreate, *, commit: bool = True) -> Word:
    return create_word_record(
        db,
        payload,
        commit=commit,
        word_cls=Word,
        assert_no_duplicate_word_fn=assert_no_duplicate_word,
        existing_normalized_terms_fn=existing_normalized_terms,
    )


def update_word(db: Session, word: Word, payload: WordUpdate, *, commit: bool = True) -> Word:
    return update_word_record(
        db,
        word,
        payload,
        commit=commit,
        record_level_change_fn=record_level_change,
        assert_no_duplicate_word_fn=assert_no_duplicate_word,
        existing_normalized_terms_fn=existing_normalized_terms,
    )


def soft_delete_word(db: Session, word: Word) -> Word:
    return soft_delete_word_record(db, word)


def restore_word(db: Session, word: Word) -> Word:
    return restore_word_record(db, word)


def hard_delete_word(db: Session, word: Word) -> None:
    hard_delete_word_record(db, word)
