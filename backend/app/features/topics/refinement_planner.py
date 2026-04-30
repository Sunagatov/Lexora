from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.repository import get_all_topics, get_topic_by_id_with_words
from app.features.topics.refinement_clusters import (
    CLUSTERS,
    TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD,
    TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD,
    TOPIC_SPLIT_MIN_WORDS,
    ClusterDefinition,
    WordLike,
)
from app.features.topics.refinement_plan_support import (
    PlanTarget,
    build_empty_plan_response,
    build_plan_response,
    build_small_topic_response,
    cluster_score as _cluster_score,
    find_existing_topic_match as _find_existing_topic_match_impl,
    init_plan_state,
    merge_target_key as _merge_target_key_impl,
)
from app.features.topics.refinement_schemas import (
    TopicSplitPlanRequest,
    TopicSplitPlanResponse,
)


def _word_cluster_candidates(word: WordLike, include_existing_co_topics: bool) -> list[tuple[int, ClusterDefinition]]:
    candidates: list[tuple[int, ClusterDefinition]] = []
    for cluster in CLUSTERS:
        score = _cluster_score(word, cluster, include_existing_co_topics)
        if score > 0:
            candidates.append((score, cluster))
    candidates.sort(key=lambda item: (-item[0], -item[1].priority, item[1].name))
    return candidates


def _find_existing_topic_match(
    cluster: ClusterDefinition,
    existing_topics: list[Topic],
) -> tuple[Topic | None, float]:
    return _find_existing_topic_match_impl(
        cluster,
        existing_topics,
        reuse_threshold=TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD,
    )


def _merge_target_key(
    *,
    topic_id: int | None,
    topic_name: str,
    accepted_targets: dict[str, tuple[int | None, str]],
) -> str | None:
    return _merge_target_key_impl(
        topic_id=topic_id,
        topic_name=topic_name,
        accepted_targets=accepted_targets,
        merge_threshold=TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD,
    )


def _build_split_plan(
    db: Session,
    topic: Topic,
    payload: TopicSplitPlanRequest,
    *,
    get_all_topics_fn: Callable[[Session], list[Topic]],
) -> TopicSplitPlanResponse:
    words = [word for word in getattr(topic, "words", []) if getattr(word, "deleted_at", None) is None]
    if not words:
        return build_empty_plan_response(topic, "topic has no active words")

    if len(words) <= TOPIC_SPLIT_MIN_WORDS:
        return build_small_topic_response(topic, words)

    state = init_plan_state()
    existing_topics = [existing_topic for existing_topic in get_all_topics_fn(db) if existing_topic.id != topic.id]

    for word in words:
        candidates = _word_cluster_candidates(word, payload.include_existing_co_topics)
        if not candidates:
            continue
        score, cluster = candidates[0]
        target_topic, _ = _find_existing_topic_match(cluster, existing_topics)
        if target_topic is not None:
            target_key = f"existing:{target_topic.id}"
            topic_id = target_topic.id
            topic_name = target_topic.name
            description = target_topic.description
            is_new_topic = False
            priority = 100
        else:
            topic_id = None
            topic_name = cluster.name
            description = cluster.description
            is_new_topic = True
            target_key = f"new:{cluster.key}"
            priority = cluster.priority

        merge_key = _merge_target_key(
            topic_id=topic_id,
            topic_name=topic_name,
            accepted_targets={
                key: (target.topic_id, target.topic_name)
                for key, target in state.target_lookup.items()
            },
        )
        if merge_key is not None:
            target_key = merge_key
            target = state.target_lookup[target_key]
            topic_id = target.topic_id
            topic_name = target.topic_name
            description = target.description
            is_new_topic = target.is_new_topic
            priority = target.priority

        state.grouped_words[target_key].append((score, word))
        state.target_lookup[target_key] = PlanTarget(
            topic_id=topic_id,
            topic_name=topic_name,
            description=description,
            is_new_topic=is_new_topic,
            priority=priority,
        )
        state.assigned_words.add(word.id)

    return build_plan_response(topic, words, payload, state)


def build_topic_split_plan(
    db: Session,
    topic_id: int,
    payload: TopicSplitPlanRequest,
    *,
    get_all_topics_fn: Callable[[Session], list[Topic]] | None = None,
    get_topic_by_id_with_words_fn: Callable[[Session, int], Topic | None] | None = None,
) -> TopicSplitPlanResponse:
    topic_loader = get_topic_by_id_with_words_fn or get_topic_by_id_with_words
    all_topics_loader = get_all_topics_fn or get_all_topics
    topic = topic_loader(db, topic_id)
    if topic is None:
        raise ValueError(f"Topic not found: {topic_id}")
    return _build_split_plan(
        db,
        topic,
        payload,
        get_all_topics_fn=all_topics_loader,
    )


def build_topic_split_prompt(topic_name: str, words: list[str], max_new_topics: int) -> str:
    word_lines = "\n".join(f"- {word}" for word in words)
    return f"""\
You are refining vocabulary topics in a language-learning app.

Goal:
Split one broad topic into smaller, specific, learner-friendly topics.

Rules:
- Return JSON only.
- Propose between 2 and {max_new_topics} subtopics.
- Only split topics with more than 300 active words.
- Keep names short, practical, and specific.
- Prefer fewer, broader buckets over many narrow siblings.
- If two buckets would read as near-synonyms, merge them.
- Do not invent words.
- Reuse an existing active topic if it already matches a subtopic closely.
- Do not create duplicate or near-duplicate topic names.
- A word may fit more than one subtopic, but prefer the best primary grouping.
- Return only valid JSON with no markdown fences or explanation.

Source topic:
{topic_name}

Words:
{word_lines}

Return this shape:
{{
  "proposed_subtopics": [
    {{
      "name": "Cleaning Tools and Supplies",
      "description": "Words for cleaning tools and products.",
      "word_terms": ["mop", "sponge", "detergent"]
    }}
  ],
  "unassigned_terms": []
}}
"""
