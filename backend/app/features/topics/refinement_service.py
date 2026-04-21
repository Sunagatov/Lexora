from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.repository import get_all_topics, get_all_topics_with_words, get_topic_by_id_with_words
from app.features.topics.refinement_schemas import (
    ProposedSubtopic,
    TopicAuditItem,
    TopicAuditResponse,
    TopicSplitPlanRequest,
    TopicSplitPlanResponse,
)

GENERIC_NAME_TOKENS = {
    "basic",
    "common",
    "general",
    "home",
    "house",
    "household",
    "life",
    "repairs",
    "stuff",
    "things",
}

TOPIC_SPLIT_MIN_WORDS = 300
TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD = 0.6
TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD = 0.8
NAME_STOPWORDS = {"and", "for", "of", "the", "to", "with"}


@dataclass(frozen=True)
class ClusterDefinition:
    key: str
    name: str
    description: str
    keywords: frozenset[str]
    priority: int


class WordLike(Protocol):
    id: int
    term: str


CLUSTERS: tuple[ClusterDefinition, ...] = (
    ClusterDefinition(
        key="cleaning",
        name="Cleaning Tools and Supplies",
        description="Words for cleaning tools, products, and everyday cleaning tasks.",
        keywords=frozenset(
            {
                "clean", "cleaning", "wash", "washing", "mop", "broom", "brush", "sponge",
                "cloth", "detergent", "soap", "bleach", "vacuum", "dust", "duster", "bucket",
                "scrub", "polish", "disinfect", "stain",
            }
        ),
        priority=10,
    ),
    ClusterDefinition(
        key="diy_tools",
        name="DIY Hand Tools",
        description="Words for basic tools used in repairs, fixing, and assembly.",
        keywords=frozenset(
            {
                "tool", "tools", "hammer", "drill", "screwdriver", "wrench", "spanner", "pliers",
                "saw", "nail", "screw", "clamp", "chisel", "ladder", "bit", "bits", "measure",
                "tape", "toolbox",
            }
        ),
        priority=9,
    ),
    ClusterDefinition(
        key="appliances",
        name="Kitchen Appliances",
        description="Words for common household and kitchen appliances.",
        keywords=frozenset(
            {
                "appliance", "appliances", "oven", "microwave", "kettle", "toaster", "blender",
                "mixer", "fridge", "freezer", "dishwasher", "cooker", "hob", "stove", "grill",
                "washing", "machine", "food", "processor",
            }
        ),
        priority=8,
    ),
    ClusterDefinition(
        key="electrical",
        name="Electrical Fixtures and Wiring",
        description="Words for plugs, sockets, switches, wiring, and light fittings.",
        keywords=frozenset(
            {
                "plug", "socket", "switch", "switches", "wire", "wiring", "cable", "bulb", "lamp",
                "light", "lights", "fuse", "charger", "circuit", "breaker", "battery", "electric",
                "electricity", "extension",
            }
        ),
        priority=7,
    ),
    ClusterDefinition(
        key="plumbing",
        name="Plumbing and Heating",
        description="Words for taps, pipes, leaks, heating systems, and bathroom fittings.",
        keywords=frozenset(
            {
                "tap", "taps", "faucet", "sink", "pipe", "pipes", "leak", "drain", "boiler",
                "radiator", "hose", "valve", "pump", "toilet", "shower", "bath", "heater",
                "heating", "thermostat", "plumbing",
            }
        ),
        priority=6,
    ),
    ClusterDefinition(
        key="decorating",
        name="Decorating and Surface Repair",
        description="Words for painting, wallpapering, patching, and surface finishing.",
        keywords=frozenset(
            {
                "paint", "painting", "brush", "roller", "wallpaper", "wall", "plaster", "filler",
                "sealant", "caulk", "sandpaper", "varnish", "trim", "patch", "decorating",
            }
        ),
        priority=5,
    ),
    ClusterDefinition(
        key="laundry",
        name="Laundry and Fabric Care",
        description="Words for washing clothes, ironing, and fabric care.",
        keywords=frozenset(
            {
                "laundry", "wash", "washing", "dryer", "drying", "iron", "ironing", "stain",
                "fabric", "clothes", "clothing", "basket", "detergent", "softener", "peg",
                "line", "clothesline",
            }
        ),
        priority=4,
    ),
    ClusterDefinition(
        key="garden",
        name="Garden and Outdoor Care",
        description="Words for garden work, outdoor maintenance, and yard tools.",
        keywords=frozenset(
            {
                "garden", "outdoor", "lawn", "grass", "hedge", "rake", "shovel", "spade", "hose",
                "compost", "weed", "weeds", "patio", "fence", "yard", "plant", "plants",
            }
        ),
        priority=3,
    ),
    ClusterDefinition(
        key="storage",
        name="Storage and Organisation",
        description="Words for containers, shelves, drawers, and keeping things organised.",
        keywords=frozenset(
            {
                "storage", "organise", "organize", "organising", "organizing", "shelf", "shelves",
                "box", "boxes", "bin", "bins", "drawer", "cupboard", "cabinet", "container",
                "basket", "rack", "hook", "hooks",
            }
        ),
        priority=2,
    ),
)


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


def _active_topics(word: WordLike | object) -> list[Topic]:
    return [topic for topic in getattr(word, "topics", []) if getattr(topic, "deleted_at", None) is None]


def _topic_audit(topic: Topic) -> TopicAuditItem:
    words = [word for word in getattr(topic, "words", []) if getattr(word, "deleted_at", None) is None]
    word_count = len(words)
    if word_count == 0:
        return TopicAuditItem(
            topic_id=topic.id,
            topic_name=topic.name,
            word_count=0,
            shared_word_count=0,
            exclusive_word_count=0,
            average_topics_per_word=0.0,
            broadness_score=0.0,
            reasons=["empty topic"],
            should_review=False,
        )

    shared_word_count = sum(1 for word in words if len(_active_topics(word)) > 1)
    active_topic_refs = sum(len(_active_topics(word)) for word in words)
    average_topics_per_word = active_topic_refs / word_count
    shared_ratio = shared_word_count / word_count

    reasons: list[str] = []
    score = 0.0
    if word_count >= 120:
        score += 0.45
        reasons.append(f"large topic: {word_count} words")
    elif word_count >= 80:
        score += 0.3
        reasons.append(f"broad topic size: {word_count} words")
    elif word_count >= 50:
        score += 0.15
        reasons.append(f"moderately large topic: {word_count} words")

    topic_tokens = _tokenize(topic.name)
    if topic_tokens & GENERIC_NAME_TOKENS:
        score += 0.3
        reasons.append("generic topic name")
    if len(topic.name.split()) >= 4:
        score += 0.1
        reasons.append("compound topic name")
    if shared_ratio >= 0.5:
        score += 0.2
        reasons.append("many words already shared with other topics")
    elif shared_ratio >= 0.25:
        score += 0.1
        reasons.append("some words already shared with other topics")
    if average_topics_per_word >= 2.5:
        score += 0.15
        reasons.append("words belong to several topics on average")
    if word_count > TOPIC_SPLIT_MIN_WORDS:
        score += 0.25
        reasons.append(f"meets the >{TOPIC_SPLIT_MIN_WORDS} word split threshold")

    score = min(score, 1.0)
    should_review = word_count > TOPIC_SPLIT_MIN_WORDS

    return TopicAuditItem(
        topic_id=topic.id,
        topic_name=topic.name,
        word_count=word_count,
        shared_word_count=shared_word_count,
        exclusive_word_count=word_count - shared_word_count,
        average_topics_per_word=round(average_topics_per_word, 2),
        broadness_score=round(score, 2),
        reasons=reasons or ["topic looks focused"],
        should_review=should_review,
    )


def build_topic_audit(db: Session) -> TopicAuditResponse:
    topics = get_all_topics_with_words(db)
    items = [_topic_audit(topic) for topic in topics]
    items.sort(key=lambda item: (-int(item.should_review), -item.broadness_score, -item.word_count, item.topic_name.casefold()))
    return TopicAuditResponse(items=items)


def _cluster_score(word: WordLike, cluster: ClusterDefinition, include_existing_co_topics: bool) -> int:
    tokens = _tokenize(getattr(word, "term", ""))
    score = len(tokens & cluster.keywords)
    if include_existing_co_topics:
        for topic in _active_topics(word):
            score += len(_tokenize(topic.name) & cluster.keywords)
    return score


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
    best_topic: Topic | None = None
    best_score = 0.0
    for topic in existing_topics:
        score = _topic_name_similarity(cluster.name, topic.name)
        if score > best_score or (score == best_score and best_topic is not None and topic.name.casefold() < best_topic.name.casefold()):
            best_topic = topic
            best_score = score
    if best_topic is not None and best_score >= TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD:
        return best_topic, best_score
    return None, best_score


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
        if existing_topic_id is None and _topic_name_similarity(topic_name, existing_topic_name) >= TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD:
            return key
    return None


def _build_split_plan(db: Session, topic: Topic, payload: TopicSplitPlanRequest) -> TopicSplitPlanResponse:
    words = [word for word in getattr(topic, "words", []) if getattr(word, "deleted_at", None) is None]
    if not words:
        return TopicSplitPlanResponse(
            source_topic_id=topic.id,
            source_topic_name=topic.name,
            source_word_count=0,
            should_split=False,
            reasons=["topic has no active words"],
            proposed_subtopics=[],
            unassigned_word_ids=[],
        )

    audit = _topic_audit(topic)
    if len(words) <= TOPIC_SPLIT_MIN_WORDS:
        return TopicSplitPlanResponse(
            source_topic_id=topic.id,
            source_topic_name=topic.name,
            source_word_count=len(words),
            should_split=False,
            reasons=[f"topic has {TOPIC_SPLIT_MIN_WORDS} or fewer active words"],
            proposed_subtopics=[],
            unassigned_word_ids=[word.id for word in words],
        )

    assigned_words: set[int] = set()
    grouped_words: dict[str, list[tuple[int, WordLike]]] = defaultdict(list)
    target_lookup: dict[str, tuple[int | None, str, str | None, bool, int]] = {}

    existing_topics = [existing_topic for existing_topic in get_all_topics(db) if existing_topic.id != topic.id]

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
            accepted_targets={key: (value[0], value[1]) for key, value in target_lookup.items()},
        )
        if merge_key is not None:
            target_key = merge_key
            topic_id, topic_name, description, is_new_topic, priority = target_lookup[target_key]

        grouped_words[target_key].append((score, word))
        target_lookup[target_key] = (topic_id, topic_name, description, is_new_topic, priority)
        assigned_words.add(word.id)

    proposed_subtopics: list[ProposedSubtopic] = []
    leftover_word_ids: list[int] = []

    ranked_groups = sorted(
        grouped_words.items(),
        key=lambda item: (
            -len(item[1]),
            -target_lookup[item[0]][4],
            item[0],
        ),
    )

    kept_groups = ranked_groups[:payload.max_new_topics]
    for target_key, items in kept_groups:
        topic_id, topic_name, description, is_new_topic, _ = target_lookup[target_key]
        words_in_group = [word for _, word in items]
        if len(words_in_group) < payload.min_words_per_topic:
            leftover_word_ids.extend(word.id for word in words_in_group)
            continue
        score_total = sum(score for score, _ in items)
        average_confidence = min(0.95, 0.35 + (0.1 * len(words_in_group)) + (0.05 * score_total))
        proposed_subtopics.append(
            ProposedSubtopic(
                name=topic_name,
                topic_id=topic_id,
                is_new_topic=is_new_topic,
                description=description,
                word_ids=[word.id for word in words_in_group],
                sample_terms=[word.term for word in words_in_group[:5]],
                confidence=round(average_confidence, 2),
            )
        )

    skipped_groups = ranked_groups[payload.max_new_topics :]
    for _, items in skipped_groups:
        leftover_word_ids.extend(word.id for _, word in items)

    unassigned_word_ids = leftover_word_ids + [word.id for word in words if word.id not in assigned_words]
    unassigned_word_ids = sorted(set(unassigned_word_ids))

    should_split = audit.should_review and bool(proposed_subtopics)
    reasons = list(audit.reasons)
    if proposed_subtopics:
        reasons.append(f"identified {len(proposed_subtopics)} candidate subtopics")
    else:
        reasons.append("no stable clusters reached the minimum size")

    return TopicSplitPlanResponse(
        source_topic_id=topic.id,
        source_topic_name=topic.name,
        source_word_count=len(words),
        should_split=should_split,
        reasons=reasons,
        proposed_subtopics=proposed_subtopics,
        unassigned_word_ids=unassigned_word_ids,
    )


def build_topic_split_plan(db: Session, topic_id: int, payload: TopicSplitPlanRequest) -> TopicSplitPlanResponse:
    topic = get_topic_by_id_with_words(db, topic_id)
    if topic is None:
        raise ValueError(f"Topic not found: {topic_id}")
    return _build_split_plan(db, topic, payload)


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
