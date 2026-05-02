from __future__ import annotations

from sqlalchemy import select

from app.features.topics.api import get_active_subtree_topic_ids, get_active_topic_or_none
from app.features.words.ai_curation.common import AiCurationImportError
from app.features.words.model import Word, word_topics
from app.features.words.repository_queries import with_word_details


def load_existing_words(
    db,
    source_topic_id: int,
    word_ids: list[int],
) -> dict[int, Word]:
    if not word_ids:
        return {}
    subtree_topic_ids = get_active_subtree_topic_ids(db, source_topic_id)
    words = db.scalars(
        with_word_details(
            select(Word)
            .join(word_topics, word_topics.c.word_id == Word.id)
            .where(Word.id.in_(word_ids))
            .where(Word.deleted_at.is_(None))
            .where(word_topics.c.topic_id.in_(subtree_topic_ids))
            .distinct()
        )
    ).all()
    return {int(word.id): word for word in words}


def resolve_topic_ref(
    db,
    ref,
    created_topics: dict[str, object],
):
    if ref.topic_id is not None:
        topic = get_active_topic_or_none(db, ref.topic_id)
        if topic is None:
            raise AiCurationImportError(f"Referenced topic {ref.topic_id} not found")
        return topic

    topic = created_topics.get(ref.client_key or "")
    if topic is None:
        raise AiCurationImportError(f"Referenced client_key '{ref.client_key}' was not created in topic_operations")
    return topic
