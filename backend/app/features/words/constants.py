from __future__ import annotations

from typing import Annotated, Literal, get_args

from pydantic import AfterValidator

WORD_TERM_MAX_LEN = 255

KNOWLEDGE_LEVEL_MIN = 1
KNOWLEDGE_LEVEL_MAX = 5
KNOWLEDGE_LEVELS = (1, 3, 4, 5)


def normalize_knowledge_level(level: int) -> int:
    """Old Basic ratings remain importable, but are stored as Okay."""
    return 3 if level == 2 else level


def validate_knowledge_level(level: int) -> int:
    level = normalize_knowledge_level(level)
    if level not in KNOWLEDGE_LEVELS:
        raise ValueError("Knowledge level must be 1 (Weak), 3 (Okay), 4 (Strong) or 5 (Parked)")
    return level


KnowledgeLevel = Annotated[int, AfterValidator(validate_knowledge_level)]

BULK_WORDS_MAX = 500

# ── Language ──

LANGUAGES = ("en", "ru")

# ── CEFR levels ──

CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")

# ── Register ──

REGISTER_VALUES = ("formal", "informal", "neutral", "slang", "technical")

# ── Countability (lowercase, matches DB CHECK) ──

COUNTABILITY_VALUES = ("countable", "uncountable", "both", "plural", "collective")

# ── Parts of speech (seed values — canonical source is the DB table) ──

PART_OF_SPEECH_VALUES = (
    "noun",
    "verb",
    "adjective",
    "adverb",
    "phrase",
    "preposition",
    "phrasal verb",
    "other",
)

# ── Progress sources ──

PROGRESS_SOURCE_MANUAL = "manual"
PROGRESS_SOURCE_STUDY_LIST = "study_list"
PROGRESS_SOURCE_SMART_REVIEW = "smart_review"
PROGRESS_SOURCE_QUICK_ADD = "quick_add"
PROGRESS_SOURCE_BULK_IMPORT = "bulk_import"
PROGRESS_SOURCE_XLSX_IMPORT = "xlsx_import"
PROGRESS_SOURCE_JSON_IMPORT = "json_import"

ProgressSource = Literal[
    "manual",
    "study_list",
    "smart_review",
    "quick_add",
    "bulk_import",
    "xlsx_import",
    "json_import",
]

PROGRESS_SOURCES: tuple[ProgressSource, ...] = get_args(ProgressSource)
