from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import bindparam, func, select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.domain import (
    assert_no_duplicate_word as assert_no_duplicate_word,
    assert_word_restore_allowed as assert_word_restore_allowed,
    existing_normalized_terms as existing_normalized_terms,
)
from app.features.words.model import Word, word_topics
from app.features.words.progress import record_level_change
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


@dataclass(frozen=True)
class WordStatsSnapshot:
    id: int
    knowledge_level: int | None
    part_of_speech: str | None
    example: str | None
    example_items: tuple[object, ...]
    created_at: datetime


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
        from app.features.topics.repository import get_active_subtree_topic_ids

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
    stmt = with_word_details(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc()))
    return list(db.scalars(stmt).all())


def hard_delete_deleted_words(db: Session, *, deleted_before: datetime | None = None) -> int:
    stmt = Word.__table__.delete().where(Word.deleted_at.isnot(None))
    if deleted_before is not None:
        stmt = stmt.where(Word.deleted_at < deleted_before)
    result = db.execute(stmt)
    return result.rowcount or 0


def hard_delete_words_by_ids(db: Session, word_ids: list[int]) -> int:
    if not word_ids:
        return 0
    result = db.execute(
        Word.__table__.delete().where(Word.id.in_(bindparam("orphan_word_ids", expanding=True))),
        {"orphan_word_ids": sorted(word_ids)},
    )
    return result.rowcount or 0


def count_active_words(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(Word).where(Word.deleted_at.is_(None))) or 0)


def load_topic_word_ids(db: Session, word_ids: set[int] | list[int]) -> dict[int, list[int]]:
    if not word_ids:
        return {}

    rows = db.execute(
        select(word_topics.c.topic_id, word_topics.c.word_id).where(word_topics.c.word_id.in_(word_ids))
    ).all()
    topic_word_ids: dict[int, list[int]] = {}
    for topic_id, word_id in rows:
        topic_word_ids.setdefault(int(topic_id), []).append(int(word_id))
    return topic_word_ids


def list_active_word_topic_levels(db: Session) -> list[tuple[int, int | None, int]]:
    rows = db.execute(
        select(Word.id, Word.knowledge_level, word_topics.c.topic_id)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .order_by(Word.id.asc(), word_topics.c.topic_id.asc())
    ).all()
    return [
        (int(word_id), int(level) if level is not None else None, int(topic_id))
        for word_id, level, topic_id in rows
    ]


def list_active_word_stats(db: Session) -> list[WordStatsSnapshot]:
    words = db.scalars(
        select(Word).options(selectinload(Word.example_items)).where(Word.deleted_at.is_(None))
    ).all()
    return [
        WordStatsSnapshot(
            id=int(word.id),
            knowledge_level=word.knowledge_level,
            part_of_speech=word.part_of_speech,
            example=word.example,
            example_items=tuple(getattr(word, "example_items", ()) or ()),
            created_at=word.created_at,
        )
        for word in words
    ]


def get_word_for_queue_validation(db: Session, word_id: int) -> Word | None:
    return db.get(Word, word_id)


def list_smart_review_candidates(db: Session, *, level: int, excluded_ids: set[int]) -> list[Word]:
    stmt = (
        select(Word)
        .options(selectinload(Word.topics))
        .where(Word.is_active.is_(True))
        .where(Word.deleted_at.is_(None))
        .where(Word.knowledge_level == level)
        .order_by(Word.updated_at.asc())
    )
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))
    return list(db.scalars(stmt).all())


def has_smart_review_candidate(db: Session, *, level: int, excluded_ids: set[int]) -> bool:
    stmt = (
        select(Word.id)
        .where(Word.is_active.is_(True))
        .where(Word.deleted_at.is_(None))
        .where(Word.knowledge_level == level)
        .limit(1)
    )
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))
    return db.scalar(stmt) is not None


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
