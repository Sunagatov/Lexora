from __future__ import annotations

from sqlalchemy import select

from app.features.topics.model import Topic
from app.features.topics.repository import get_active_subtree_topic_ids
from app.features.words.ai_curation.common import AiCurationImportError
from app.features.words.model import Word, word_topics
from app.features.words.repository import _with_details


def load_existing_words(
    db,
    source_topic_id: int,
    word_ids: list[int],
) -> dict[int, Word]:
    if not word_ids:
        return {}
    subtree_topic_ids = get_active_subtree_topic_ids(db, source_topic_id)
    words = db.scalars(
        _with_details(
            select(Word)
            .join(word_topics, word_topics.c.word_id == Word.id)
            .join(Topic, Topic.id == word_topics.c.topic_id)
            .where(Word.id.in_(word_ids))
            .where(Word.deleted_at.is_(None))
            .where(Topic.deleted_at.is_(None))
            .where(Topic.id.in_(subtree_topic_ids))
            .distinct()
        )
    ).all()
    return {int(word.id): word for word in words}


def resolve_topic_ref(
    db,
    ref,
    created_topics: dict[str, Topic],
) -> Topic:
    if ref.topic_id is not None:
        topic: Topic | None = db.scalar(select(Topic).where(Topic.id == ref.topic_id, Topic.deleted_at.is_(None)))
        if topic is None:
            raise AiCurationImportError(f"Referenced topic {ref.topic_id} not found")
        return topic

    topic = created_topics.get(ref.client_key or "")
    if topic is None:
        raise AiCurationImportError(f"Referenced client_key '{ref.client_key}' was not created in topic_operations")
    return topic
