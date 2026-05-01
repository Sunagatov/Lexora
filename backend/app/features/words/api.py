from dataclasses import dataclass
from datetime import datetime

from app.features.words.domain import assert_word_restore_allowed
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count
from app.features.words.exceptions import DuplicateWordInTopicError
from app.features.words.schemas import WordResponse


@dataclass(frozen=True)
class WordStatsSnapshot:
    id: int
    knowledge_level: int | None
    part_of_speech: str | None
    example: str | None
    example_items: tuple[object, ...]
    created_at: datetime


def get_deleted_words(db):
    from app.features.words.repository import get_deleted_words as _get_deleted_words

    return _get_deleted_words(db)


def get_word_by_id_including_deleted(db, word_id: int):
    from app.features.words.repository import get_word_by_id_including_deleted as _get_word_by_id_including_deleted

    return _get_word_by_id_including_deleted(db, word_id)


def restore_word(db, word):
    from app.features.words.repository import restore_word as _restore_word

    return _restore_word(db, word)


def count_active_words(db) -> int:
    from sqlalchemy import func, select

    from app.features.words.model import Word

    return int(db.scalar(select(func.count()).select_from(Word).where(Word.deleted_at.is_(None))) or 0)


def load_topic_word_ids(db, word_ids: set[int] | list[int]) -> dict[int, list[int]]:
    from collections import defaultdict

    from sqlalchemy import select

    from app.features.words.model import word_topics

    if not word_ids:
        return {}

    rows = db.execute(
        select(word_topics.c.topic_id, word_topics.c.word_id).where(word_topics.c.word_id.in_(word_ids))
    ).all()
    topic_word_ids: dict[int, list[int]] = defaultdict(list)
    for topic_id, word_id in rows:
        topic_word_ids[int(topic_id)].append(int(word_id))
    return dict(topic_word_ids)


def list_active_word_topic_levels(db) -> list[tuple[int, int | None, int]]:
    from sqlalchemy import select

    from app.features.topics.model import Topic
    from app.features.words.model import Word, word_topics

    rows = db.execute(
        select(Word.id, Word.knowledge_level, word_topics.c.topic_id)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .order_by(Word.id.asc(), word_topics.c.topic_id.asc())
    ).all()
    return [(int(word_id), int(level) if level is not None else None, int(topic_id)) for word_id, level, topic_id in rows]


def list_active_word_stats(db) -> list[WordStatsSnapshot]:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.features.words.model import Word

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


def get_word_for_queue_validation(db, word_id: int):
    from app.features.words.model import Word

    return db.get(Word, word_id)


def list_smart_review_candidates(db, *, level: int, excluded_ids: set[int]):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.features.words.model import Word

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


def has_smart_review_candidate(db, *, level: int, excluded_ids: set[int]) -> bool:
    from sqlalchemy import select

    from app.features.words.model import Word

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


def apply_word_response_loaders(base_loader):
    from app.features.words.model import Word

    return (
        base_loader.selectinload(Word.topics),
        base_loader.selectinload(Word.translation_items),
        base_loader.selectinload(Word.example_items),
    )

__all__ = [
    "apply_word_response_loaders",
    "count_active_words",
    "DuplicateWordInTopicError",
    "EXAMPLE_TARGET_COUNT",
    "WordStatsSnapshot",
    "WordResponse",
    "assert_word_restore_allowed",
    "example_count",
    "get_deleted_words",
    "get_word_for_queue_validation",
    "get_word_by_id_including_deleted",
    "has_smart_review_candidate",
    "list_active_word_topic_levels",
    "list_active_word_stats",
    "list_smart_review_candidates",
    "load_topic_word_ids",
    "restore_word",
]
