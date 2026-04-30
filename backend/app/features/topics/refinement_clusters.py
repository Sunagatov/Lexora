from __future__ import annotations

from app.features.topics.refinement_cluster_config import (
    CLUSTERS as CLUSTERS,
    GENERIC_NAME_TOKENS as GENERIC_NAME_TOKENS,
    TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD as TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD,
    TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD as TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD,
    TOPIC_SPLIT_MIN_WORDS as TOPIC_SPLIT_MIN_WORDS,
    ClusterDefinition as ClusterDefinition,
    WordLike as WordLike,
)
from app.features.topics.refinement_cluster_text import (
    _active_topics as _active_topics,
    _is_parts_of_speech_topic as _is_parts_of_speech_topic,
    _tokenize as _tokenize,
    _topic_name_similarity as _topic_name_similarity,
)
