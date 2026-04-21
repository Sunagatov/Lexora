from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from app.features.topics.model import Topic

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
TOPIC_NAME_SIMILARITY_REUSE_THRESHOLD = 0.5
TOPIC_NAME_SIMILARITY_MERGE_THRESHOLD = 0.5
NAME_STOPWORDS = {"and", "for", "of", "the", "to", "with"}
PARTS_OF_SPEECH_TOPICS = {
    "adjectives",
    "adverbs",
    "nouns",
    "parts of speech",
    "phrases",
    "prepositions",
    "verbs",
    "irregular verbs",
}


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
        key="cleaning_laundry",
        name="Cleaning and Laundry",
        description="Words for household cleaning, washing clothes, and fabric care.",
        keywords=frozenset(
            {
                "clean", "cleaning", "wash", "washing", "mop", "broom", "brush", "sponge",
                "cloth", "detergent", "soap", "bleach", "vacuum", "dust", "duster", "bucket",
                "scrub", "polish", "disinfect", "stain", "laundry", "dryer", "drying", "iron",
                "ironing", "softener", "peg", "line", "clothesline", "basket",
            }
        ),
        priority=10,
    ),
    ClusterDefinition(
        key="diy_repairs_tools",
        name="DIY Repairs and Tools",
        description="Words for basic tools and simple repair work around the home.",
        keywords=frozenset(
            {
                "tool", "tools", "hammer", "drill", "screwdriver", "wrench", "spanner", "pliers",
                "saw", "nail", "screw", "clamp", "chisel", "ladder", "bit", "bits", "measure",
                "tape", "toolbox", "repair", "fix", "fixing", "assemble", "assembly",
            }
        ),
        priority=9,
    ),
    ClusterDefinition(
        key="appliances_home_systems",
        name="Appliances and Home Systems",
        description="Words for kitchen appliances and common household systems.",
        keywords=frozenset(
            {
                "appliance", "appliances", "oven", "microwave", "kettle", "toaster", "blender",
                "mixer", "fridge", "freezer", "dishwasher", "cooker", "hob", "stove", "grill",
                "washing", "machine", "food", "processor", "plug", "socket", "switch", "wire",
                "wiring", "cable", "bulb", "lamp", "light", "lights", "fuse", "charger",
                "circuit", "breaker", "battery", "electric", "electricity", "extension",
                "radiator", "boiler", "tap", "sink", "pipe", "leak", "drain", "hose", "valve",
                "pump", "toilet", "shower", "bath", "heater", "heating", "thermostat",
            }
        ),
        priority=8,
    ),
    ClusterDefinition(
        key="decorating_surface",
        name="Decorating and Surface Repair",
        description="Words for painting, patching, wallpapering, and surface finishing.",
        keywords=frozenset(
            {
                "paint", "painting", "brush", "roller", "wallpaper", "wall", "plaster", "filler",
                "sealant", "caulk", "sandpaper", "varnish", "trim", "patch", "decorating",
            }
        ),
        priority=7,
    ),
    ClusterDefinition(
        key="storage_organisation",
        name="Storage and Organisation",
        description="Words for storing, sorting, and organising things at home.",
        keywords=frozenset(
            {
                "storage", "organise", "organize", "organising", "organizing", "shelf", "shelves",
                "box", "boxes", "bin", "bins", "drawer", "cupboard", "cabinet", "container",
                "basket", "rack", "hook", "hooks", "wardrobe", "closet",
            }
        ),
        priority=6,
    ),
    ClusterDefinition(
        key="garden_outdoor",
        name="Garden and Outdoor Care",
        description="Words for garden work, outdoor maintenance, and yard tools.",
        keywords=frozenset(
            {
                "garden", "outdoor", "lawn", "grass", "hedge", "rake", "shovel", "spade", "hose",
                "compost", "weed", "weeds", "patio", "fence", "yard", "plant", "plants",
            }
        ),
        priority=5,
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


def _is_parts_of_speech_topic(topic_name: str) -> bool:
    normalized = topic_name.casefold().strip()
    return normalized in PARTS_OF_SPEECH_TOPICS


def _active_topics(word: WordLike | object) -> list[Topic]:
    return [topic for topic in getattr(word, "topics", []) if getattr(topic, "deleted_at", None) is None]
