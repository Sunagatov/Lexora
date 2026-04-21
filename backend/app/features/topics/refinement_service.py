from __future__ import annotations

from app.features.topics import repository as _repository
from app.features.topics import refinement_audit as _audit
from app.features.topics.refinement_clusters import _topic_name_similarity as _clusters_topic_name_similarity
from app.features.topics import refinement_planner as _planner


def build_topic_audit(db):
    _audit.get_all_topics_with_words = _repository.get_all_topics_with_words
    return _audit.build_topic_audit(db)


def build_topic_split_plan(db, topic_id, payload):
    _planner.get_all_topics = _repository.get_all_topics
    _planner.get_topic_by_id_with_words = _repository.get_topic_by_id_with_words
    return _planner.build_topic_split_plan(db, topic_id, payload)


def build_topic_split_prompt(topic_name, words, max_new_topics):
    return _planner.build_topic_split_prompt(topic_name, words, max_new_topics)


def _merge_target_key(*args, **kwargs):
    return _planner._merge_target_key(*args, **kwargs)


def _topic_name_similarity(left, right):
    return _clusters_topic_name_similarity(left, right)
