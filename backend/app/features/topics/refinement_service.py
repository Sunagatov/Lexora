from __future__ import annotations

from app.features.topics import refinement_audit as _audit
from app.features.topics import refinement_planner as _planner
from app.features.topics.repository import get_all_topics, get_all_topics_with_words, get_topic_by_id_with_words
def build_topic_audit(db):
    return _audit.build_topic_audit(
        db,
        get_all_topics_with_words_fn=get_all_topics_with_words,
    )


def build_topic_split_plan(db, topic_id, payload):
    return _planner.build_topic_split_plan(
        db,
        topic_id,
        payload,
        get_all_topics_fn=get_all_topics,
        get_topic_by_id_with_words_fn=get_topic_by_id_with_words,
    )


def build_topic_split_prompt(topic_name, words, max_new_topics):
    return _planner.build_topic_split_prompt(topic_name, words, max_new_topics)


def _merge_target_key(*args, **kwargs):
    return _planner._merge_target_key(*args, **kwargs)


def _topic_name_similarity(left, right):
    from app.features.topics.refinement_clusters import _topic_name_similarity as _clusters_topic_name_similarity

    return _clusters_topic_name_similarity(left, right)
