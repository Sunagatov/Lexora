from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from app.features.topics.refinement_clusters import (
    CLUSTERS,
    TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD,
    TOPIC_SPLIT_MIN_WORDS,
    ClusterDefinition,
    WordLike,
    _cluster_score,
    _find_existing_topic_match,
    _topic_name_similarity,
)
from app.features.topics.refinement_schemas import ProposedSubtopic, TopicSplitPlanRequest, TopicSplitPlanResponse


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


def build_topic_split_plan(
    db,
    topic_id: int,
    payload: TopicSplitPlanRequest,
    *,
    get_all_topics_fn,
    get_topic_by_id_with_words_fn,
) -> TopicSplitPlanResponse:
    topic = get_topic_by_id_with_words_fn(db, topic_id)
    if topic is None:
        raise ValueError(f"Topic not found: {topic_id}")

    words = [word for word in getattr(topic, "words", []) if getattr(word, "deleted_at", None) is None]
    if not words:
        return _build_empty_plan_response(topic, "topic has no active words")
    if len(words) <= TOPIC_SPLIT_MIN_WORDS:
        return _build_small_topic_response(topic, words)

    state = _init_plan_state()
    existing_topics = [existing_topic for existing_topic in get_all_topics_fn(db) if existing_topic.id != topic.id]

    for word in words:
        candidates = _word_cluster_candidates(word, payload.include_existing_co_topics)
        if not candidates:
            continue
        score, cluster = candidates[0]
        target_topic, _ = _find_existing_topic_match(cluster, existing_topics)
        if target_topic is not None:
            target_key = f"existing:{target_topic.id}"
            target = PlanTarget(
                topic_id=target_topic.id,
                topic_name=target_topic.name,
                description=target_topic.description,
                is_new_topic=False,
                priority=100,
            )
        else:
            target_key = f"new:{cluster.key}"
            target = PlanTarget(
                topic_id=None,
                topic_name=cluster.name,
                description=cluster.description,
                is_new_topic=True,
                priority=cluster.priority,
            )

        merge_key = _merge_target_key(
            topic_id=target.topic_id,
            topic_name=target.topic_name,
            accepted_targets={key: (item.topic_id, item.topic_name) for key, item in state.target_lookup.items()},
        )
        if merge_key is not None:
            target_key = merge_key
            target = state.target_lookup[target_key]

        state.grouped_words[target_key].append((score, word))
        state.target_lookup[target_key] = target
        state.assigned_words.add(word.id)

    return _build_plan_response(topic, words, payload, state)


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


def _merge_target_key(
    *,
    topic_id: int | None,
    topic_name: str,
    accepted_targets: dict[str, tuple[int | None, str]],
) -> str | None:
    if topic_id is not None:
        for key, (existing_topic_id, _) in accepted_targets.items():
            if existing_topic_id == topic_id:
                return key
        return None

    for key, (existing_topic_id, existing_topic_name) in accepted_targets.items():
        if (
            existing_topic_id is None
            and _topic_name_similarity(topic_name, existing_topic_name) >= TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD
        ):
            return key
    return None


def _init_plan_state() -> PlanState:
    return PlanState(assigned_words=set(), grouped_words=defaultdict(list), target_lookup={})


def _build_empty_plan_response(topic, reason: str) -> TopicSplitPlanResponse:
    return TopicSplitPlanResponse(
        source_topic_id=topic.id,
        source_topic_name=topic.name,
        source_word_count=0,
        should_split=False,
        reasons=[reason],
        proposed_subtopics=[],
        unassigned_word_ids=[],
    )


def _build_small_topic_response(topic, words: list[WordLike]) -> TopicSplitPlanResponse:
    return TopicSplitPlanResponse(
        source_topic_id=topic.id,
        source_topic_name=topic.name,
        source_word_count=len(words),
        should_split=False,
        reasons=[f"topic has {TOPIC_SPLIT_MIN_WORDS} or fewer active words"],
        proposed_subtopics=[],
        unassigned_word_ids=[word.id for word in words],
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


def _build_plan_response(topic, words: list[WordLike], payload: TopicSplitPlanRequest, state: PlanState) -> TopicSplitPlanResponse:
    proposed_subtopics: list[ProposedSubtopic] = []
    leftover_word_ids: list[int] = []

    ranked_groups = sorted(
        state.grouped_words.items(),
        key=lambda item: (-len(item[1]), -state.target_lookup[item[0]].priority, item[0]),
    )

    for target_key, items in ranked_groups[: payload.max_new_topics]:
        target = state.target_lookup[target_key]
        if len(items) < payload.min_words_per_topic:
            leftover_word_ids.extend(word.id for _, word in items)
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


def _word_cluster_candidates(word: WordLike, include_existing_co_topics: bool) -> list[tuple[int, ClusterDefinition]]:
    candidates: list[tuple[int, ClusterDefinition]] = []
    for cluster in CLUSTERS:
        score = _cluster_score(word, cluster, include_existing_co_topics)
        if score > 0:
            candidates.append((score, cluster))
    candidates.sort(key=lambda item: (-item[0], -item[1].priority, item[1].name))
    return candidates
