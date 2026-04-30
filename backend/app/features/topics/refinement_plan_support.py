from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from app.features.topics.model import Topic
from app.features.topics.refinement_clusters import (
    TOPIC_SPLIT_MIN_WORDS,
    ClusterDefinition,
    WordLike,
    _active_topics,
    _tokenize,
    _topic_name_similarity,
)
from app.features.topics.refinement_schemas import (
    ProposedSubtopic,
    TopicSplitPlanRequest,
    TopicSplitPlanResponse,
)


@dataclass
class PlanTarget:
    topic_id: int | None
    topic_name: str
    description: str | None
    is_new_topic: bool
    priority: int


@dataclass
class PlanState:
    assigned_words: set[int]
    grouped_words: dict[str, list[tuple[int, WordLike]]]
    target_lookup: dict[str, PlanTarget]


def init_plan_state() -> PlanState:
    return PlanState(
        assigned_words=set(),
        grouped_words=defaultdict(list),
        target_lookup={},
    )


def cluster_score(word: WordLike, cluster: ClusterDefinition, include_existing_co_topics: bool) -> int:
    tokens = _tokenize(getattr(word, "term", ""))
    score = len(tokens & cluster.keywords)
    if include_existing_co_topics:
        for topic in _active_topics(word):
            score += len(_tokenize(topic.name) & cluster.keywords)
    return score


def find_existing_topic_match(
    cluster: ClusterDefinition,
    existing_topics: list[Topic],
    *,
    reuse_threshold: float,
) -> tuple[Topic | None, float]:
    best_topic: Topic | None = None
    best_score = 0.0
    for topic in existing_topics:
        score = _topic_name_similarity(cluster.name, topic.name)
        if score > best_score or (
            score == best_score
            and best_topic is not None
            and topic.name.casefold() < best_topic.name.casefold()
        ):
            best_topic = topic
            best_score = score
    if best_topic is not None and best_score >= reuse_threshold:
        return best_topic, best_score
    return None, best_score


def merge_target_key(
    *,
    topic_id: int | None,
    topic_name: str,
    accepted_targets: dict[str, tuple[int | None, str]],
    merge_threshold: float,
) -> str | None:
    if topic_id is not None:
        for key, (existing_topic_id, _) in accepted_targets.items():
            if existing_topic_id == topic_id:
                return key
        return None

    for key, (existing_topic_id, existing_topic_name) in accepted_targets.items():
        if existing_topic_id is None and _topic_name_similarity(topic_name, existing_topic_name) >= merge_threshold:
            return key
    return None


def build_empty_plan_response(topic: Topic, reason: str) -> TopicSplitPlanResponse:
    return TopicSplitPlanResponse(
        source_topic_id=topic.id,
        source_topic_name=topic.name,
        source_word_count=0,
        should_split=False,
        reasons=[reason],
        proposed_subtopics=[],
        unassigned_word_ids=[],
    )


def build_small_topic_response(topic: Topic, words: list[WordLike]) -> TopicSplitPlanResponse:
    return TopicSplitPlanResponse(
        source_topic_id=topic.id,
        source_topic_name=topic.name,
        source_word_count=len(words),
        should_split=False,
        reasons=[f"topic has {TOPIC_SPLIT_MIN_WORDS} or fewer active words"],
        proposed_subtopics=[],
        unassigned_word_ids=[word.id for word in words],
    )


def build_plan_response(
    topic: Topic,
    words: list[WordLike],
    payload: TopicSplitPlanRequest,
    state: PlanState,
) -> TopicSplitPlanResponse:
    proposed_subtopics: list[ProposedSubtopic] = []
    leftover_word_ids: list[int] = []

    ranked_groups = sorted(
        state.grouped_words.items(),
        key=lambda item: (-len(item[1]), -state.target_lookup[item[0]].priority, item[0]),
    )

    for target_key, items in ranked_groups[: payload.max_new_topics]:
        target = state.target_lookup[target_key]
        words_in_group = [word for _, word in items]
        if len(words_in_group) < payload.min_words_per_topic:
            leftover_word_ids.extend(word.id for word in words_in_group)
            continue
        proposed_subtopics.append(_build_proposed_subtopic(target, items))

    for _, items in ranked_groups[payload.max_new_topics :]:
        leftover_word_ids.extend(word.id for _, word in items)

    unassigned_word_ids = sorted(
        set(leftover_word_ids + [word.id for word in words if word.id not in state.assigned_words])
    )
    reasons = [f"topic has more than {TOPIC_SPLIT_MIN_WORDS} active words"]
    if proposed_subtopics:
        reasons.append(f"identified {len(proposed_subtopics)} candidate subtopics")
    else:
        reasons.append("no stable clusters reached the minimum size")

    return TopicSplitPlanResponse(
        source_topic_id=topic.id,
        source_topic_name=topic.name,
        source_word_count=len(words),
        should_split=bool(proposed_subtopics),
        reasons=reasons,
        proposed_subtopics=proposed_subtopics,
        unassigned_word_ids=unassigned_word_ids,
    )


def _build_proposed_subtopic(target: PlanTarget, items: list[tuple[int, WordLike]]) -> ProposedSubtopic:
    words_in_group = [word for _, word in items]
    score_total = sum(score for score, _ in items)
    average_confidence = min(0.95, 0.35 + (0.1 * len(words_in_group)) + (0.05 * score_total))
    return ProposedSubtopic(
        name=target.topic_name,
        topic_id=target.topic_id,
        is_new_topic=target.is_new_topic,
        description=target.description,
        word_ids=[word.id for word in words_in_group],
        sample_terms=[word.term for word in words_in_group[:5]],
        confidence=round(average_confidence, 2),
    )
