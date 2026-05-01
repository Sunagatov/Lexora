from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import bindparam, func, select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.domain import (
    assert_no_duplicate_word as assert_no_duplicate_word,
    assert_word_restore_allowed as assert_word_restore_allowed,
    existing_normalized_terms as existing_normalized_terms,
)
from app.features.words.model import Word, word_topics
from app.features.words.constants import PROGRESS_SOURCE_MANUAL
from app.features.words.progress import record_level_change
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
    assert_no_duplicate_word(payload.term, existing_normalized_terms(db, payload.topic_ids))
    topics = _load_topics(db, payload.topic_ids)
    data = payload.model_dump(exclude={"topic_ids", "translation_entries", "example_entries"})
    word = Word(**data, topics=list(topics))
    sync_word_multivalue_fields(
        word,
        payload.translations,
        payload.translation_entries,
        payload.example,
        payload.example_entries,
    )
    db.add(word)
    _finalize_write(db, word, commit=commit)
    return word


def update_word(db: Session, word: Word, payload: WordUpdate, *, commit: bool = True) -> Word:
    effective_term = _effective_term(word, payload)
    target_topic_ids = _target_topic_ids(word, payload)
    if _requires_duplicate_check(word, payload, effective_term):
        assert_no_duplicate_word(
            effective_term,
            existing_normalized_terms(db, target_topic_ids, exclude_word_id=word.id),
        )

    old_level = word.knowledge_level
    for field, value in _word_attribute_updates(payload).items():
        setattr(word, field, value)

    if _multivalue_update_requested(payload):
        _apply_multivalue_update(db, word, payload)

    if payload.topic_ids is not None:
        word.topics = _load_topics(db, payload.topic_ids)

    if "knowledge_level" in payload.model_fields_set:
        if payload.knowledge_level != old_level and payload.knowledge_level is not None:
            source = payload.progress_source or PROGRESS_SOURCE_MANUAL
            record_level_change(db, int(word.id), old_level, int(payload.knowledge_level), source)

    db.add(word)
    _finalize_write(db, word, commit=commit)
    return word


def soft_delete_word(db: Session, word: Word) -> Word:
    word.deleted_at = datetime.now(timezone.utc)
    word.deleted_via_topic_id = None
    db.add(word)
    _finalize_write(db, word, commit=True)
    return word


def restore_word(db: Session, word: Word) -> Word:
    word.deleted_at = None
    word.deleted_via_topic_id = None
    db.add(word)
    _finalize_write(db, word, commit=True)
    return word


def hard_delete_word(db: Session, word: Word) -> None:
    db.delete(word)
    db.commit()


def _load_topics(db: Session, topic_ids: list[int]) -> list[Topic]:
    return list(db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all())


def _finalize_write(db: Session, word: Word, *, commit: bool) -> None:
    if commit:
        db.commit()
        db.refresh(word)
    else:
        db.flush()


def _effective_term(word: Word, payload: WordUpdate) -> str:
    data = payload.model_dump(exclude_unset=True, exclude={"topic_ids", "progress_source"})
    return data.get("term", word.term)


def _target_topic_ids(word: Word, payload: WordUpdate) -> list[int]:
    return payload.topic_ids if payload.topic_ids is not None else [int(topic.id) for topic in word.topics]


def _requires_duplicate_check(word: Word, payload: WordUpdate, effective_term: str) -> bool:
    data = payload.model_dump(exclude_unset=True, exclude={"topic_ids", "progress_source"})
    term_changed = "term" in data and effective_term != word.term
    topics_changed = payload.topic_ids is not None and set(payload.topic_ids) != {int(topic.id) for topic in word.topics}
    return term_changed or topics_changed


def _word_attribute_updates(payload: WordUpdate) -> dict[str, object]:
    return payload.model_dump(
        exclude_unset=True,
        exclude={
            "topic_ids",
            "progress_source",
            "translations",
            "translation_entries",
            "example",
            "example_entries",
        },
    )

def _multivalue_update_requested(payload: WordUpdate) -> bool:
    fields = payload.model_fields_set
    return "translations" in fields or "translation_entries" in fields or "example" in fields or "example_entries" in fields


def _apply_multivalue_update(db: Session, word: Word, payload: WordUpdate) -> None:
    current_translations_text = word.translations
    current_example_text = getattr(word, "example", None)
    current_translation_entries = [item.value for item in getattr(word, "translation_items", [])]
    current_example_entries = [item.value for item in getattr(word, "example_items", [])]

    word.translation_items = []
    word.example_items = []
    db.flush()

    sync_word_multivalue_fields(
        word,
        payload.translations if "translations" in payload.model_fields_set else current_translations_text,
        _resolved_translation_entries(payload, current_translation_entries),
        payload.example if "example" in payload.model_fields_set else current_example_text,
        _resolved_example_entries(payload, current_example_entries),
    )


def _resolved_translation_entries(payload: WordUpdate, current_translation_entries: list[str]) -> list[str] | None:
    if "translation_entries" in payload.model_fields_set:
        return payload.translation_entries
    if "translations" in payload.model_fields_set:
        return None
    return current_translation_entries


def _resolved_example_entries(payload: WordUpdate, current_example_entries: list[str]) -> list[str] | None:
    if "example_entries" in payload.model_fields_set:
        return payload.example_entries
    if "example" in payload.model_fields_set:
        return None
    return current_example_entries
