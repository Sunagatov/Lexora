from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.repository import (
    count_active_topics as count_active_topics,
    find_active_topic_by_exact_name as find_active_topic_by_exact_name,
    find_active_topic_by_slug as find_active_topic_by_slug,
    find_deleted_topic_by_exact_name as find_deleted_topic_by_exact_name,
    find_deleted_topic_by_slug as find_deleted_topic_by_slug,
    get_active_subtree_topic_ids as get_active_subtree_topic_ids,
    get_active_topic_or_none as get_active_topic_or_none,
    get_deleted_topics as get_deleted_topics,
    get_all_topics as get_all_topics,
    get_topic_by_id_including_deleted as get_topic_by_id_including_deleted,
    get_topic_by_id as get_topic_by_id,
    hard_delete_topics_by_ids as hard_delete_topics_by_ids,
    list_active_topics_page_rows as list_active_topics_page_rows,
    list_deleted_topics_for_purge as list_deleted_topics_for_purge,
    soft_delete_topic as soft_delete_topic,
)
from app.features.topics.service import (
    create_topic_draft as create_topic_draft,
    create_topic_from_values as create_topic_from_values,
    restore_topic as restore_topic,
)


def delete_topic(db: Session, topic: Topic, *, delete_words: bool = False) -> Topic:
    return soft_delete_topic(db, topic, delete_words=delete_words)
