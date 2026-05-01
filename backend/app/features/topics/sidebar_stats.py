from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.schemas import TopicSidebarStatsResponse
from app.features.words.repository import count_active_words, list_active_word_topic_levels


def compute_topic_sidebar_stats(db: Session) -> TopicSidebarStatsResponse:
    topics = list(db.scalars(select(Topic).where(Topic.deleted_at.is_(None)).order_by(Topic.id.asc())).all())
    total_words = count_active_words(db)
    if not topics:
        return TopicSidebarStatsResponse(total_words=total_words, topic_counts={}, topic_progress={})

    topics_by_id = {topic.id: topic for topic in topics}
    ancestors_by_topic_id = {
        topic.id: _collect_ancestors(topic.id, topics_by_id)
        for topic in topics
    }

    counts: dict[int, int] = defaultdict(int)
    level_delta_sum: dict[int, int] = defaultdict(int)
    level_count: dict[int, int] = defaultdict(int)

    rows = list_active_word_topic_levels(db)

    current_word_id: int | None = None
    current_level: int | None = None
    current_topic_ids: set[int] = set()

    def flush_word() -> None:
        if current_word_id is None:
            return
        ancestor_ids = {
            ancestor_id
            for topic_id in current_topic_ids
            for ancestor_id in ancestors_by_topic_id.get(topic_id, [topic_id])
        }
        for ancestor_id in ancestor_ids:
            counts[ancestor_id] += 1
            if current_level is not None and 1 <= current_level <= 4:
                level_delta_sum[ancestor_id] += current_level - 1
                level_count[ancestor_id] += 1

    for word_id, level, topic_id in rows:
        word_id_int = int(word_id)
        if current_word_id is None:
            current_word_id = word_id_int
        elif word_id_int != current_word_id:
            flush_word()
            current_word_id = word_id_int
            current_topic_ids = set()

        current_level = int(level) if level is not None else None
        current_topic_ids.add(int(topic_id))

    flush_word()

    topic_counts = {topic.id: counts.get(topic.id, 0) for topic in topics}
    topic_progress = {
        topic.id: round(level_delta_sum[topic.id] * 100 / (3 * level_count[topic.id]))
        for topic in topics
        if level_count.get(topic.id, 0) > 0
    }
    return TopicSidebarStatsResponse(
        total_words=total_words,
        topic_counts=topic_counts,
        topic_progress=topic_progress,
    )


def _collect_ancestors(topic_id: int, topics_by_id: dict[int, Topic]) -> list[int]:
    ancestors = [topic_id]
    parent_id = topics_by_id[topic_id].parent_topic_id
    while parent_id is not None and parent_id in topics_by_id:
        ancestors.append(parent_id)
        parent_id = topics_by_id[parent_id].parent_topic_id
    return ancestors
