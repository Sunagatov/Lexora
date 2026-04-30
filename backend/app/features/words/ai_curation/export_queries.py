from __future__ import annotations

from sqlalchemy import func, select

from app.features.topics.model import Topic
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT
from app.features.words.model import Word, WordExample, word_topics
from app.features.words.repository import _with_details


def _topic_list_stmt(*, offset: int, page_size: int):
    return (
        select(
            Topic.id,
            Topic.name,
            Topic.slug,
            Topic.description,
            Topic.is_active,
            func.count(Word.id).label("word_count"),
        )
        .select_from(Topic)
        .outerjoin(word_topics, word_topics.c.topic_id == Topic.id)
        .outerjoin(Word, (Word.id == word_topics.c.word_id) & Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .group_by(Topic.id)
        .order_by(Topic.name.asc(), Topic.id.asc())
        .offset(offset)
        .limit(page_size)
    )


def _topic_words_count_stmt(subtree_topic_ids: list[int], *, needs_examples_only: bool = False):
    stmt = (
        select(func.count(func.distinct(Word.id)))
        .select_from(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
    )
    if needs_examples_only:
        stmt = stmt.where(_needs_examples_filter())
    return stmt


def _topic_words_stmt(subtree_topic_ids: list[int], *, needs_examples_only: bool):
    stmt = (
        select(Word)
        .join(word_topics, word_topics.c.word_id == Word.id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.deleted_at.is_(None))
        .where(Topic.deleted_at.is_(None))
        .where(Topic.id.in_(subtree_topic_ids))
        .distinct()
    )
    if needs_examples_only:
        stmt = stmt.where(_needs_examples_filter())
    return stmt


def _load_topic_words(
    db,
    subtree_topic_ids: list[int],
    *,
    page: int,
    page_size: int,
    needs_examples_only: bool,
) -> list[Word]:
    offset = (page - 1) * page_size
    stmt = (
        _topic_words_stmt(subtree_topic_ids, needs_examples_only=needs_examples_only)
        .order_by(Word.term.asc(), Word.id.asc())
        .offset(offset)
        .limit(page_size)
    )
    return list(db.scalars(_with_details(stmt)).all())


def _needs_examples_filter():
    complete_word_ids = (
        select(WordExample.word_id)
        .group_by(WordExample.word_id)
        .having(func.count(WordExample.id) >= EXAMPLE_TARGET_COUNT)
    )
    return Word.id.not_in(complete_word_ids)
