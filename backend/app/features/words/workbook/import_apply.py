from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from app.features.words.constants import PROGRESS_SOURCE_XLSX_IMPORT
from app.features.words.workbook.cells import _split_examples_cell, _split_translation_cell
from app.features.words.workbook.format import InvalidWorkbookError
from app.features.words.workbook.import_rows import _row_fingerprint
from app.features.words.workbook.import_rules import _normalize_part_of_speech, _validate_part_of_speech


@dataclass(frozen=True)
class WorkbookImportFlags:
    has_knowledge: bool
    has_pattern: bool
    has_examples: bool
    has_countability: bool
    has_part_of_speech: bool
    has_past_simple: bool
    has_past_participle: bool
    has_notes: bool


@dataclass(frozen=True)
class WorkbookImportOps:
    should_validate_existing_word_duplicate: Callable[[Any, str, bool], bool]
    assert_no_duplicate_word: Callable[[str, set[str]], None]
    existing_normalized_terms: Callable[[Any, list[int], int | None], set[str]]
    record_level_change: Callable[[Any, int, int | None, int, str], None]
    sync_word_multivalue_fields: Callable[[Any, str, list[str], str | None, list[str]], None]
    word_cls: Callable[..., Any]


@dataclass(frozen=True)
class WorkbookSheetContext:
    flags: WorkbookImportFlags
    sheet_name: str
    seen_existing_words: dict[int, tuple[str, tuple[object, ...]]]
    ops: WorkbookImportOps


def update_existing_word_from_row(
    db,
    *,
    existing,
    row,
    topic,
    row_idx: int,
    context: WorkbookSheetContext,
) -> None:
    existing_topic_ids = {existing_topic.id for existing_topic in existing.topics}
    topic_was_missing = topic.id not in existing_topic_ids
    if topic_was_missing:
        existing.topics.append(topic)

    if context.ops.should_validate_existing_word_duplicate(existing, row.term, topic_was_missing):
        context.ops.assert_no_duplicate_word(
            row.term,
            context.ops.existing_normalized_terms(db, [int(topic.id)], exclude_word_id=int(existing.id)),
        )

    old_level = existing.knowledge_level
    effective_knowledge_level = row.knowledge_value if context.flags.has_knowledge else existing.knowledge_level
    effective_countability = row.countability if context.flags.has_countability else existing.countability
    effective_pattern = row.pattern if context.flags.has_pattern else existing.pattern
    effective_examples_text = row.examples_text if context.flags.has_examples else existing.example
    effective_part_of_speech = _normalize_part_of_speech(
        _validate_part_of_speech(row.part_of_speech_text, context.sheet_name, row_idx)
        if context.flags.has_part_of_speech
        else None,
        effective_countability,
        existing.past_simple if not context.flags.has_past_simple else row.past_simple,
        existing.past_participle if not context.flags.has_past_participle else row.past_participle,
        existing.part_of_speech,
    )
    effective_past_simple = row.past_simple if context.flags.has_past_simple else existing.past_simple
    effective_past_participle = row.past_participle if context.flags.has_past_participle else existing.past_participle
    effective_notes = row.notes if context.flags.has_notes else existing.notes

    fingerprint = _row_fingerprint(
        term=row.term,
        translations_text=row.translations_text,
        knowledge_value=effective_knowledge_level,
        pattern=effective_pattern,
        examples_text=effective_examples_text,
        countability=effective_countability,
        part_of_speech=effective_part_of_speech,
        past_simple=effective_past_simple,
        past_participle=effective_past_participle,
        notes=effective_notes,
    )
    _track_existing_word_fingerprint(
        existing_id=int(existing.id),
        sheet_name=context.sheet_name,
        fingerprint=fingerprint,
        seen_existing_words=context.seen_existing_words,
    )

    existing.term = row.term
    existing.translations = row.translations_text
    existing.knowledge_level = effective_knowledge_level
    existing.countability = effective_countability
    existing.pattern = effective_pattern
    existing.notes = effective_notes
    existing.past_simple = effective_past_simple
    existing.past_participle = effective_past_participle
    existing.part_of_speech = effective_part_of_speech

    context.ops.sync_word_multivalue_fields(
        existing,
        row.translations_text,
        _split_translation_cell(row.translations_text),
        effective_examples_text,
        _split_examples_cell(effective_examples_text),
    )

    if existing.knowledge_level != old_level and existing.knowledge_level is not None:
        context.ops.record_level_change(
            db,
            int(existing.id),
            old_level,
            existing.knowledge_level,
            PROGRESS_SOURCE_XLSX_IMPORT,
        )

    db.add(existing)
    db.flush()


def create_new_word_from_row(
    db,
    *,
    row,
    topic,
    row_idx: int,
    context: WorkbookSheetContext,
) -> None:
    context.ops.assert_no_duplicate_word(row.term, context.ops.existing_normalized_terms(db, [int(topic.id)], None))

    knowledge_for_create = row.knowledge_value if row.knowledge_value is not None else 1
    part_of_speech = _normalize_part_of_speech(
        _validate_part_of_speech(row.part_of_speech_text, context.sheet_name, row_idx)
        if context.flags.has_part_of_speech
        else None,
        row.countability if context.flags.has_countability else None,
        row.past_simple if context.flags.has_past_simple else None,
        row.past_participle if context.flags.has_past_participle else None,
        None,
    )

    word = context.ops.word_cls(
        term=row.term,
        past_simple=row.past_simple if context.flags.has_past_simple else None,
        past_participle=row.past_participle if context.flags.has_past_participle else None,
        translations=row.translations_text,
        part_of_speech=part_of_speech,
        knowledge_level=knowledge_for_create,
        countability=row.countability if context.flags.has_countability else None,
        pattern=row.pattern if context.flags.has_pattern else None,
        example=row.examples_text if context.flags.has_examples else None,
        notes=row.notes if context.flags.has_notes else None,
        is_active=True,
        topics=[topic],
    )
    context.ops.sync_word_multivalue_fields(
        word,
        row.translations_text,
        _split_translation_cell(row.translations_text),
        row.examples_text if context.flags.has_examples else None,
        _split_examples_cell(row.examples_text if context.flags.has_examples else None),
    )

    db.add(word)
    db.flush()


def _track_existing_word_fingerprint(
    *,
    existing_id: int,
    sheet_name: str,
    fingerprint: tuple[object, ...],
    seen_existing_words: dict[int, tuple[str, tuple[object, ...]]],
) -> None:
    previous = seen_existing_words.get(existing_id)
    if previous is None:
        seen_existing_words[existing_id] = (sheet_name, fingerprint)
        return

    previous_sheet, previous_fingerprint = previous
    if previous_fingerprint != fingerprint:
        raise InvalidWorkbookError(
            f"Word ID {existing_id} appears with conflicting values in sheets "
            f"'{previous_sheet}' and '{sheet_name}'. Shared words must be edited consistently."
        )
