from __future__ import annotations

import re

from app.features.topics.model import Topic
from app.features.topics.refinement_cluster_config import NAME_STOPWORDS, PARTS_OF_SPEECH_TOPICS, WordLike


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z]+", text.casefold()))


def _normalized_name_tokens(text: str) -> set[str]:
    return {token for token in _tokenize(text) if token not in NAME_STOPWORDS}


def _topic_name_similarity(left: str, right: str) -> float:
    left_tokens = _normalized_name_tokens(left)
    right_tokens = _normalized_name_tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens)
    if overlap == 0:
        return 0.0
    union = len(left_tokens | right_tokens)
    coverage = overlap / min(len(left_tokens), len(right_tokens))
    jaccard = overlap / union
    return max(coverage, jaccard)


def _is_parts_of_speech_topic(topic_name: str) -> bool:
    normalized = topic_name.casefold().strip()
    return normalized in PARTS_OF_SPEECH_TOPICS


def _active_topics(word: WordLike | object) -> list[Topic]:
    return [topic for topic in getattr(word, "topics", []) if getattr(topic, "deleted_at", None) is None]
