from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from app.features.words.ai_curation.common import AiCurationImportError
from app.features.words.ai_curation.schemas import AiCurationImportRequest, TopicRef, WordUpdateV2
from app.features.words.model import Word


@dataclass(frozen=True)
class AiCurationImportOperations:
    create_topic: Callable[..., object]
    create_word: Callable[..., object]
    update_word: Callable[..., object]
    resolve_topic_ref: Callable[..., object]


def _assert_unique_ids(ids: list[int], label: str) -> None:
    duplicates = sorted(word_id for word_id, count in Counter(ids).items() if count > 1)
    if not duplicates:
        return
    if label == "word_updates":
        raise AiCurationImportError(f"Duplicate existing word ids in payload: {duplicates}")
    if label == "word_reassigns":
        raise AiCurationImportError(f"Duplicate reassign word ids in payload: {duplicates}")
    raise AiCurationImportError(f"Duplicate {label} word ids in payload: {duplicates}")


def _collect_existing_word_ids(payload: AiCurationImportRequest) -> list[int]:
    update_ids = [op.id for op in payload.word_updates]
    reassign_ids = [op.id for op in payload.word_reassigns]
    _assert_unique_ids(update_ids, "word_updates")
    _assert_unique_ids(reassign_ids, "word_reassigns")
    return update_ids + reassign_ids


def _validate_payload_ids(payload: AiCurationImportRequest, words_by_id: dict[int, Word]) -> None:
    existing_ids = _collect_existing_word_ids(payload)
    missing_ids = sorted(set(existing_ids) - set(words_by_id))
    if missing_ids:
        raise AiCurationImportError(f"These word ids do not exist in source topic: {missing_ids}")


def _check_stale(word: Word, exported_at: datetime, label: str) -> None:
    if word.updated_at is not None and word.updated_at > exported_at:
        raise AiCurationImportError(
            f"{label}: word {word.id} ('{word.term}') was modified after export "
            f"(word.updated_at={word.updated_at.isoformat()}, "
            f"exported_at={exported_at.isoformat()}). Re-export and re-run."
        )


def _has_changes(word: Word, op: WordUpdateV2) -> bool:
    for field in op.model_fields_set - {"id"}:
        if getattr(op, field) != _current_value(word, field):
            return True
    return False


def _current_value(word: Word, field: str):
    if field == "translation_entries":
        return [item.value for item in getattr(word, "translation_items", [])]
    if field == "example_entries":
        return [item.value for item in getattr(word, "example_items", [])]
    if field == "synonym_entries":
        return [item.value for item in getattr(word, "synonym_items", [])]
    if field == "antonym_entries":
        return [item.value for item in getattr(word, "antonym_items", [])]
    if field == "collocation_entries":
        return [item.value for item in getattr(word, "collocation_items", [])]
    if field == "part_of_speech":
        pos = word.part_of_speech
        return pos.name if pos else None
    return getattr(word, field, None)


def _resolve_topic_id_set(
    operations: AiCurationImportOperations,
    db,
    refs: list[TopicRef],
    created_topics,
) -> set[int]:
    return {
        operations.resolve_topic_ref(db, ref, created_topics).id
        for ref in refs
    }
