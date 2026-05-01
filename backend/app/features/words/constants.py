from __future__ import annotations

from typing import Literal, get_args

WORD_TERM_MAX_LEN = 255
WORD_VERB_FORM_MAX_LEN = 255
WORD_POS_MAX_LEN = 50
WORD_COUNT_MAX_LEN = 50

KNOWLEDGE_LEVEL_MIN = 1
KNOWLEDGE_LEVEL_MAX = 5

BULK_WORDS_MAX = 500

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
