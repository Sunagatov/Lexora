from __future__ import annotations

from dataclasses import dataclass

from app.features.words.workbook.cells import (
    _read_optional_int,
    _read_str,
    _validate_countability,
    _validate_max_length,
)
from app.features.words.constants import WORD_TERM_MAX_LEN
from app.features.words.workbook.format import InvalidWorkbookError


@dataclass(frozen=True)
class WorkbookRowData:
    term: str
    translations_text: str
    word_id: int | None
    knowledge_value: int | None
    pattern: str | None
    examples_text: str | None
    countability: str | None
    part_of_speech_text: str | None
    definition: str | None
    cefr_level: str | None
    register: str | None
    notes: str | None


def _read_row_data(ws, row_idx: int, header_map: dict[str, int]) -> WorkbookRowData | None:
    term = _validate_max_length(
        _read_str(ws, row_idx, header_map.get("term")),
        WORD_TERM_MAX_LEN,
        "word",
        ws.title,
        row_idx,
    )
    if not term:
        return None

    translations_text = _read_str(ws, row_idx, header_map.get("translations"))
    if not translations_text:
        raise InvalidWorkbookError(f"{ws.title}, row {row_idx}: translations are required for '{term}'")

    knowledge_value = _read_optional_int(ws, row_idx, header_map.get("knowledge_level"), "knowledge", ws.title)
    if knowledge_value is not None and knowledge_value not in {1, 2, 3, 4, 5}:
        raise InvalidWorkbookError(f"{ws.title}, row {row_idx}: knowledge must be between 1 and 5")

    return WorkbookRowData(
        term=term,
        translations_text=translations_text,
        word_id=_read_optional_int(ws, row_idx, header_map.get("word_id"), "word id", ws.title),
        knowledge_value=knowledge_value,
        pattern=_read_str(ws, row_idx, header_map.get("pattern")),
        examples_text=_read_str(ws, row_idx, header_map.get("examples")),
        countability=_validate_countability(
            _read_str(ws, row_idx, header_map.get("countability")), ws.title, row_idx,
        ),
        part_of_speech_text=_read_str(ws, row_idx, header_map.get("part_of_speech")),
        definition=_read_str(ws, row_idx, header_map.get("definition")),
        cefr_level=_read_str(ws, row_idx, header_map.get("cefr_level")),
        register=_read_str(ws, row_idx, header_map.get("register")),
        notes=_read_str(ws, row_idx, header_map.get("notes")),
    )


def _row_fingerprint(
    *,
    term: str,
    translations_text: str,
    knowledge_value: int | None,
    pattern: str | None,
    examples_text: str | None,
    countability: str | None,
    part_of_speech: str | None,
    definition: str | None,
    notes: str | None,
) -> tuple[object, ...]:
    return (
        term.strip(),
        translations_text.strip(),
        knowledge_value,
        (pattern or "").strip(),
        (examples_text or "").strip(),
        (countability or "").strip().lower(),
        (part_of_speech or "").strip().lower(),
        (definition or "").strip(),
        (notes or "").strip(),
    )
