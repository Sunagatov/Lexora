from app.features.words.workbook.workbook_styling import COUNTABILITY_ALIASES as COUNTABILITY_ALIASES
from app.features.words.workbook.workbook_styling import COUNTABILITY_VALUES as COUNTABILITY_VALUES
from app.features.words.workbook.workbook_styling import EXPORT_COLUMNS as EXPORT_COLUMNS
from app.features.words.workbook.workbook_styling import EXTRA_EMPTY_ROWS as EXTRA_EMPTY_ROWS
from app.features.words.workbook.workbook_styling import LISTS_SHEET_NAME as LISTS_SHEET_NAME
from app.features.words.workbook.workbook_styling import META_SHEET_NAME as META_SHEET_NAME
from app.features.words.workbook.workbook_styling import PART_OF_SPEECH_VALUES as PART_OF_SPEECH_VALUES
from app.features.words.workbook.workbook_styling import _add_dynamic_row_colors as _add_dynamic_row_colors
from app.features.words.workbook.workbook_styling import _add_validations as _add_validations
from app.features.words.workbook.workbook_styling import _apply_base_styling as _apply_base_styling
from app.features.words.workbook.workbook_styling import _create_lists_sheet as _create_lists_sheet
from app.features.words.workbook.workbook_styling import _create_meta_sheet as _create_meta_sheet
from app.features.words.workbook.workbook_styling import _safe_sheet_title as _safe_sheet_title
from app.features.words.workbook.workbook_styling import _set_column_widths as _set_column_widths

MAX_WORKBOOK_BYTES = 10 * 1024 * 1024

HEADER_ALIASES: dict[str, set[str]] = {
    "knowledge_level": {"knowledge", "level"},
    "term": {"word", "term", "base form", "phrase"},
    "translations": {
        "russian translations",
        "translations",
        "translation",
        "russian translation",
    },
    "pattern": {
        "typical prepositions / patterns",
        "pattern",
        "patterns",
        "prepositions / patterns",
        "typical position / usage",
    },
    "examples": {"examples (en + ru)", "examples", "example", "example (en+ru)"},
    "countability": {"countability"},
    "part_of_speech": {"part of speech", "pos"},
    "notes": {"notes", "note", "meaning / usage note"},
    "word_id": {"word id", "id"},
    "definition": {"definition"},
    "cefr_level": {"cefr", "cefr level"},
    "register": {"register"},
}


class InvalidWorkbookError(Exception):
    pass
