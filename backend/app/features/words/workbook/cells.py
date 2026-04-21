from __future__ import annotations

import re

from app.features.words.workbook.format import (
    COUNTABILITY_ALIASES,
    COUNTABILITY_VALUES,
    HEADER_ALIASES,
    META_SHEET_NAME,
    InvalidWorkbookError,
)


def _normalize_header(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def _build_header_map(ws) -> dict[str, int]:
    result: dict[str, int] = {}
    for column_idx in range(1, ws.max_column + 1):
        raw = ws.cell(row=1, column=column_idx).value
        header = _normalize_header(str(raw) if raw is not None else "")
        for canonical, aliases in HEADER_ALIASES.items():
            if header in aliases:
                result[canonical] = column_idx
                break
    return result


def _read_str(ws, row_idx: int, column_idx: int | None) -> str | None:
    if column_idx is None:
        return None
    value = ws.cell(row=row_idx, column=column_idx).value
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _validate_max_length(
    value: str | None,
    max_len: int,
    label: str,
    sheet_name: str,
    row_idx: int,
) -> str | None:
    if value is not None and len(value) > max_len:
        raise InvalidWorkbookError(
            f"{sheet_name}, row {row_idx}: {label} must be at most {max_len} characters"
        )
    return value


def _read_optional_int(
    ws, row_idx: int, column_idx: int | None, label: str, sheet_name: str
) -> int | None:
    if column_idx is None:
        return None
    raw = ws.cell(row=row_idx, column=column_idx).value
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError) as exc:
        raise InvalidWorkbookError(
            f"{sheet_name}, row {row_idx}: invalid {label} value '{raw}'"
        ) from exc


def _split_translation_cell(value: str | None) -> list[str]:
    if value is None:
        return []
    text = value.strip()
    if not text:
        return []
    if "\n" in text or ";" in text:
        parts = re.split(r"(?:\r?\n|;)+", text)
        return [part.strip() for part in parts if part and part.strip()]
    return [text]


def _split_examples_cell(value: str | None) -> list[str]:
    if value is None:
        return []
    text = value.strip()
    if not text:
        return []
    parts = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return [part.strip() for part in parts if part and part.strip()]


def _normalize_countability(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return COUNTABILITY_ALIASES.get(normalized.casefold(), normalized)


def _validate_countability(value: str | None, sheet_name: str, row_idx: int) -> str | None:
    normalized = _normalize_countability(value)
    if normalized is not None and normalized not in COUNTABILITY_VALUES:
        allowed = ", ".join(COUNTABILITY_VALUES)
        raise InvalidWorkbookError(
            f"{sheet_name}, row {row_idx}: countability must be blank or one of: {allowed}"
        )
    return normalized


def _read_meta_topic_names(workbook) -> dict[str, str]:
    if META_SHEET_NAME not in workbook.sheetnames:
        return {}

    ws = workbook[META_SHEET_NAME]
    result: dict[str, str] = {}
    for row_idx in range(2, ws.max_row + 1):
        sheet_name = _read_str(ws, row_idx, 1)
        topic_name = _read_str(ws, row_idx, 3)
        if sheet_name and topic_name:
            result[sheet_name] = topic_name
    return result


def _read_meta_topic_refs(workbook) -> dict[str, tuple[int | None, str | None]]:
    if META_SHEET_NAME not in workbook.sheetnames:
        return {}

    ws = workbook[META_SHEET_NAME]
    result: dict[str, tuple[int | None, str | None]] = {}
    for row_idx in range(2, ws.max_row + 1):
        sheet_name = _read_str(ws, row_idx, 1)
        topic_id = _read_optional_int(ws, row_idx, 2, "topic id", META_SHEET_NAME)
        topic_name = _read_str(ws, row_idx, 3)
        if sheet_name:
            result[sheet_name] = (topic_id, topic_name)
    return result
