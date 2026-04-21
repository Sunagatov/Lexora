from __future__ import annotations

from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.features.stats.service import record_level_change
from app.features.topics.model import Topic
from app.features.words.domain import assert_no_duplicate_word, existing_normalized_terms
from app.features.words.model import Word
from app.features.words.repository import sync_word_multivalue_fields
from app.features.words.schemas import WorkbookImportResponse, WorkbookImportSheetSummary
from app.features.words.workbook.cells import (
    _build_header_map,
    _read_meta_topic_names,
    _read_optional_int,
    _read_str,
    _split_examples_cell,
    _split_translation_cell,
    _validate_countability,
    _validate_max_length,
)
from app.features.words.workbook.format import (
    LISTS_SHEET_NAME,
    MAX_WORKBOOK_BYTES,
    META_SHEET_NAME,
    InvalidWorkbookError,
)
from app.features.words.workbook.import_rules import (
    _find_existing_word,
    _get_topic,
    _normalize_part_of_speech,
    _should_validate_existing_word_duplicate,
    _validate_part_of_speech,
)
from app.shared.constraints import (
    WORD_TERM_MAX_LEN,
    WORD_VERB_FORM_MAX_LEN,
)


def _import_sheet(
    db: Session, ws, header_map: dict[str, int], topic: Topic
) -> WorkbookImportSheetSummary:
    created = 0
    updated = 0
    skipped = 0
    seen_word_ids: set[int] = set()

    has_knowledge = "knowledge_level" in header_map
    has_pattern = "pattern" in header_map
    has_examples = "examples" in header_map
    has_countability = "countability" in header_map
    has_part_of_speech = "part_of_speech" in header_map
    has_past_simple = "past_simple" in header_map
    has_past_participle = "past_participle" in header_map
    has_notes = "notes" in header_map

    for row_idx in range(2, ws.max_row + 1):
        term = _validate_max_length(
            _read_str(ws, row_idx, header_map.get("term")),
            WORD_TERM_MAX_LEN,
            "word",
            ws.title,
            row_idx,
        )
        if not term:
            continue

        translations_text = _read_str(ws, row_idx, header_map.get("translations"))
        if not translations_text:
            raise InvalidWorkbookError(
                f"{ws.title}, row {row_idx}: translations are required for '{term}'"
            )

        word_id = _read_optional_int(ws, row_idx, header_map.get("word_id"), "word id", ws.title)
        if word_id is not None:
            if word_id in seen_word_ids:
                raise InvalidWorkbookError(
                    f"{ws.title}, row {row_idx}: duplicate Word ID {word_id} in this sheet"
                )
            seen_word_ids.add(word_id)

        knowledge_value = (
            _read_optional_int(ws, row_idx, header_map.get("knowledge_level"), "knowledge", ws.title)
            if has_knowledge
            else None
        )
        if knowledge_value is not None and knowledge_value not in {1, 2, 3, 4, 5}:
            raise InvalidWorkbookError(f"{ws.title}, row {row_idx}: knowledge must be between 1 and 5")

        pattern = _read_str(ws, row_idx, header_map.get("pattern")) if has_pattern else None
        examples_text = _read_str(ws, row_idx, header_map.get("examples")) if has_examples else None
        countability = (
            _validate_countability(
                _read_str(ws, row_idx, header_map.get("countability")),
                ws.title,
                row_idx,
            )
            if has_countability
            else None
        )
        past_simple = (
            _validate_max_length(
                _read_str(ws, row_idx, header_map.get("past_simple")),
                WORD_VERB_FORM_MAX_LEN,
                "past simple",
                ws.title,
                row_idx,
            )
            if has_past_simple
            else None
        )
        past_participle = (
            _validate_max_length(
                _read_str(ws, row_idx, header_map.get("past_participle")),
                WORD_VERB_FORM_MAX_LEN,
                "past participle",
                ws.title,
                row_idx,
            )
            if has_past_participle
            else None
        )
        notes = _read_str(ws, row_idx, header_map.get("notes")) if has_notes else None

        existing = _find_existing_word(db, topic.id, word_id, term)

        if existing is not None:
            existing_topic_ids = {t.id for t in existing.topics}
            topic_was_missing = topic.id not in existing_topic_ids
            if topic_was_missing:
                existing.topics.append(topic)

            if _should_validate_existing_word_duplicate(existing, term, topic_was_missing):
                assert_no_duplicate_word(
                    term,
                    existing_normalized_terms(db, [topic.id], exclude_word_id=existing.id),
                )

            old_level = existing.knowledge_level

            existing.term = term
            existing.translations = translations_text
            existing.knowledge_level = knowledge_value if has_knowledge else existing.knowledge_level
            existing.countability = countability if has_countability else existing.countability
            existing.pattern = pattern if has_pattern else existing.pattern
            existing.notes = notes if has_notes else existing.notes
            existing.past_simple = past_simple if has_past_simple else existing.past_simple
            existing.past_participle = (
                past_participle if has_past_participle else existing.past_participle
            )
            part_of_speech_value = (
                _validate_part_of_speech(
                    _read_str(ws, row_idx, header_map.get("part_of_speech")),
                    ws.title,
                    row_idx,
                )
                if has_part_of_speech
                else None
            )
            existing.part_of_speech = _normalize_part_of_speech(
                part_of_speech_value,
                existing.countability,
                existing.past_simple,
                existing.past_participle,
                existing.part_of_speech,
            )

            sync_word_multivalue_fields(
                existing,
                translations_text,
                _split_translation_cell(translations_text),
                examples_text if has_examples else existing.example,
                _split_examples_cell(examples_text)
                if has_examples
                else [item.value for item in existing.example_items],
            )

            if existing.knowledge_level != old_level and existing.knowledge_level is not None:
                record_level_change(db, existing.id, old_level, existing.knowledge_level, "xlsx_import")

            db.add(existing)
            db.flush()
            updated += 1
            continue

        assert_no_duplicate_word(term, existing_normalized_terms(db, [topic.id]))

        knowledge_for_create = knowledge_value if knowledge_value is not None else 1
        part_of_speech_value = (
            _validate_part_of_speech(
                _read_str(ws, row_idx, header_map.get("part_of_speech")),
                ws.title,
                row_idx,
            )
            if has_part_of_speech
            else None
        )
        part_of_speech = _normalize_part_of_speech(
            part_of_speech_value,
            countability,
            past_simple,
            past_participle,
            None,
        )

        word = Word(
            term=term,
            past_simple=past_simple,
            past_participle=past_participle,
            translations=translations_text,
            part_of_speech=part_of_speech,
            knowledge_level=knowledge_for_create,
            countability=countability,
            pattern=pattern,
            example=examples_text,
            notes=notes,
            is_active=True,
            topics=[topic],
        )
        sync_word_multivalue_fields(
            word,
            translations_text,
            _split_translation_cell(translations_text),
            examples_text,
            _split_examples_cell(examples_text),
        )

        db.add(word)
        db.flush()
        created += 1

    return WorkbookImportSheetSummary(
        sheet_name=ws.title,
        topic_name=topic.name,
        created=created,
        updated=updated,
        skipped=skipped,
    )


def import_words_workbook(db: Session, content: bytes) -> WorkbookImportResponse:
    if len(content) > MAX_WORKBOOK_BYTES:
        raise InvalidWorkbookError(
            f"Workbook is too large; maximum size is {MAX_WORKBOOK_BYTES // (1024 * 1024)} MB"
        )

    try:
        workbook = load_workbook(filename=BytesIO(content))
    except Exception as exc:
        raise InvalidWorkbookError("Failed to read XLSX workbook") from exc

    meta_topic_names = _read_meta_topic_names(workbook)

    summaries: list[WorkbookImportSheetSummary] = []
    total_created = 0
    total_updated = 0
    total_skipped = 0

    for ws in workbook.worksheets:
        if ws.sheet_state != "visible":
            continue
        if ws.title in {LISTS_SHEET_NAME, META_SHEET_NAME}:
            continue

        header_map = _build_header_map(ws)
        if "term" not in header_map or "translations" not in header_map:
            continue

        topic_name = meta_topic_names.get(ws.title, ws.title)
        topic = _get_topic(db, topic_name)

        summary = _import_sheet(db, ws, header_map, topic)
        summaries.append(summary)
        total_created += summary.created
        total_updated += summary.updated
        total_skipped += summary.skipped

    if not summaries:
        raise InvalidWorkbookError("No importable sheets found in workbook")

    db.commit()
    return WorkbookImportResponse(
        created=total_created,
        updated=total_updated,
        skipped=total_skipped,
        sheets=summaries,
    )
