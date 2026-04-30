from __future__ import annotations

from typing import Literal, get_args

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
