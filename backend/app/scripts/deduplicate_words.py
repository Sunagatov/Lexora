"""
Audit and merge duplicate vocabulary rows.

Default mode is a dry-run audit. The script prints a concise summary and can
optionally write a JSON report. `--apply` mutates the database only for groups
whose merge plan has no unresolved singular-field conflicts unless
`--allow-singular-conflicts` is also passed.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import TypedDict

from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.features.smart_review.model import StudyQueueItem
from app.features.words.model import Word, word_topics
from app.features.words.progress import WordProgressEvent
from app.features.words.repository import sync_word_multivalue_fields
from app.shared.db import SessionLocal
from app.shared.text import normalize_term

SINGULAR_FIELDS = (
    "past_simple",
    "past_participle",
    "part_of_speech",
    "countability",
)
TEXT_FIELDS = (
    "pattern",
    "notes",
)


@dataclass
class WordSummary:
    id: int
    term: str
    normalized_term: str
    is_active: bool
    knowledge_level: int | None
    topic_ids: list[int]
    translation_entries: list[str]
    example_entries: list[str]
    translations: str
    example: str | None
    notes: str | None
    pattern: str | None
    part_of_speech: str | None
    countability: str | None
    past_simple: str | None
    past_participle: str | None
    created_at: str | None
    updated_at: str | None
    progress_event_count: int
    queue_item_count: int


@dataclass
class MergePlan:
    normalized_term: str
    canonical_id: int
    duplicate_ids: list[int]
    member_ids: list[int]
    merged_topic_ids: list[int]
    merged_knowledge_level: int | None
    merged_translation_entries: list[str]
    merged_example_entries: list[str]
    merged_translations: str
    merged_example: str | None
    merged_notes: str | None
    merged_pattern: str | None
    merged_part_of_speech: str | None
    merged_countability: str | None
    merged_past_simple: str | None
    merged_past_participle: str | None
    merged_created_at: str | None
    merged_updated_at: str | None
    queue_items_to_move: int
    queue_items_to_delete: int
    progress_events_to_move: int
    singular_conflicts: dict[str, list[str]]


class DuplicateGroupReport(TypedDict):
    normalized_term: str
    plan: dict[str, object]
    members: list[dict[str, object]]


class DuplicateAuditReport(TypedDict):
    duplicate_group_count: int
    duplicate_word_count: int
    groups: list[DuplicateGroupReport]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _merge_distinct_entries(values: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for raw in values:
        cleaned = raw.strip()
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        merged.append(cleaned)
    return merged


def _merge_text_blocks(values: list[str | None]) -> str | None:
    merged = _merge_distinct_entries([value for value in values if value is not None])
    if not merged:
        return None
    return "\n\n".join(merged)


def _pick_canonical(words: list[Word]) -> Word:
    def sort_key(word: Word) -> tuple[bool, int, datetime, int]:
        return (
            word.deleted_at is None,
            word.knowledge_level or 0,
            word.updated_at or word.created_at or datetime.min,
            -int(word.id),
        )

    return max(words, key=sort_key)


def _distinct_scalar_values(words: list[Word], field: str) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for word in words:
        raw = _normalize_optional(getattr(word, field))
        if raw is None:
            continue
        key = raw.casefold()
        if key in seen:
            continue
        seen.add(key)
        values.append(raw)
    return values


def _build_singular_conflicts(words: list[Word]) -> dict[str, list[str]]:
    conflicts: dict[str, list[str]] = {}
    for field in SINGULAR_FIELDS:
        values = _distinct_scalar_values(words, field)
        if len(values) > 1:
            conflicts[field] = values
    return conflicts


def _pick_scalar_value(words: list[Word], field: str) -> str | None:
    values = _distinct_scalar_values(words, field)
    return values[0] if values else None


def _word_summary(word: Word, progress_event_count: int, queue_item_count: int) -> WordSummary:
    return WordSummary(
        id=int(word.id),
        term=word.term,
        normalized_term=normalize_term(word.term),
        is_active=word.deleted_at is None,
        knowledge_level=word.knowledge_level,
        topic_ids=sorted(int(topic.id) for topic in word.topics),
        translation_entries=[item.value for item in word.translation_items],
        example_entries=[item.value for item in word.example_items],
        translations=word.translations,
        example=word.example,
        notes=word.notes,
        pattern=word.pattern,
        part_of_speech=word.part_of_speech,
        countability=word.countability,
        past_simple=word.past_simple,
        past_participle=word.past_participle,
        created_at=_iso(word.created_at),
        updated_at=_iso(word.updated_at),
        progress_event_count=progress_event_count,
        queue_item_count=queue_item_count,
    )


def _build_merge_plan(words: list[Word], queue_rows_by_word_id: dict[int, list[tuple[int, int]]], progress_counts: dict[int, int]) -> MergePlan:
    canonical = _pick_canonical(words)
    duplicates = [word for word in words if int(word.id) != int(canonical.id)]
    merged_topic_ids = sorted({int(topic.id) for word in words for topic in word.topics})
    merged_translation_entries = _merge_distinct_entries(
        [item.value for word in words for item in word.translation_items]
    )
    merged_example_entries = _merge_distinct_entries(
        [item.value for word in words for item in word.example_items]
    )
    merged_translations = "; ".join(merged_translation_entries) or canonical.translations.strip()
    merged_example = "\n".join(merged_example_entries) or None
    singular_conflicts = _build_singular_conflicts(words)
    canonical_queue_ids = {queue_id for _, queue_id in queue_rows_by_word_id.get(int(canonical.id), [])}
    queue_items_to_move = 0
    queue_items_to_delete = 0
    for duplicate in duplicates:
        for _, queue_id in queue_rows_by_word_id.get(int(duplicate.id), []):
            if queue_id in canonical_queue_ids:
                queue_items_to_delete += 1
            else:
                queue_items_to_move += 1
                canonical_queue_ids.add(queue_id)

    created_candidates = [word.created_at for word in words if word.created_at is not None]
    updated_candidates = [word.updated_at for word in words if word.updated_at is not None]

    return MergePlan(
        normalized_term=normalize_term(canonical.term),
        canonical_id=int(canonical.id),
        duplicate_ids=sorted(int(word.id) for word in duplicates),
        member_ids=sorted(int(word.id) for word in words),
        merged_topic_ids=merged_topic_ids,
        merged_knowledge_level=max((word.knowledge_level or 0 for word in words), default=0) or None,
        merged_translation_entries=merged_translation_entries,
        merged_example_entries=merged_example_entries,
        merged_translations=merged_translations,
        merged_example=merged_example,
        merged_notes=_merge_text_blocks([word.notes for word in words]),
        merged_pattern=_merge_text_blocks([word.pattern for word in words]),
        merged_part_of_speech=_pick_scalar_value(words, "part_of_speech"),
        merged_countability=_pick_scalar_value(words, "countability"),
        merged_past_simple=_pick_scalar_value(words, "past_simple"),
        merged_past_participle=_pick_scalar_value(words, "past_participle"),
        merged_created_at=_iso(min(created_candidates) if created_candidates else None),
        merged_updated_at=_iso(max(updated_candidates) if updated_candidates else None),
        queue_items_to_move=queue_items_to_move,
        queue_items_to_delete=queue_items_to_delete,
        progress_events_to_move=sum(progress_counts.get(int(word.id), 0) for word in duplicates),
        singular_conflicts=singular_conflicts,
    )


def _load_words(db) -> tuple[dict[str, list[Word]], dict[int, list[tuple[int, int]]], dict[int, int]]:
    words = list(
        db.scalars(
            select(Word)
            .options(
                selectinload(Word.topics),
                selectinload(Word.translation_items),
                selectinload(Word.example_items),
            )
            .order_by(Word.id.asc())
        ).all()
    )
    queue_rows = db.execute(
        select(StudyQueueItem.id, StudyQueueItem.word_id, StudyQueueItem.queue_id)
        .order_by(StudyQueueItem.id.asc())
    ).all()
    queue_rows_by_word_id: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for item_id, word_id, queue_id in queue_rows:
        queue_rows_by_word_id[int(word_id)].append((int(item_id), int(queue_id)))

    progress_rows = db.execute(
        select(WordProgressEvent.word_id, text("count(*)"))
        .group_by(WordProgressEvent.word_id)
    ).all()
    progress_counts = {int(word_id): int(count) for word_id, count in progress_rows}

    groups: dict[str, list[Word]] = defaultdict(list)
    for word in words:
        groups[normalize_term(word.term)].append(word)
    return groups, queue_rows_by_word_id, progress_counts


def _build_report(db, *, only_term: str | None = None) -> DuplicateAuditReport:
    groups, queue_rows_by_word_id, progress_counts = _load_words(db)
    duplicate_groups: list[DuplicateGroupReport] = []
    for normalized_term, words in sorted(groups.items()):
        if len(words) <= 1:
            continue
        if only_term is not None and normalized_term != only_term:
            continue
        plan = _build_merge_plan(words, queue_rows_by_word_id, progress_counts)
        duplicate_groups.append(
            {
                "normalized_term": normalized_term,
                "plan": asdict(plan),
                "members": [
                    asdict(
                        _word_summary(
                            word,
                            progress_counts.get(int(word.id), 0),
                            len(queue_rows_by_word_id.get(int(word.id), [])),
                        )
                    )
                    for word in words
                ],
            }
        )
    return {
        "duplicate_group_count": len(duplicate_groups),
        "duplicate_word_count": sum(len(group["members"]) - 1 for group in duplicate_groups),
        "groups": duplicate_groups,
    }


def _apply_merge_plan(db, plan: MergePlan) -> None:
    canonical = db.scalar(
        select(Word)
        .where(Word.id == plan.canonical_id)
        .options(
            selectinload(Word.topics),
            selectinload(Word.translation_items),
            selectinload(Word.example_items),
        )
    )
    if canonical is None:
        raise RuntimeError(f"Canonical word {plan.canonical_id} not found")

    for topic_id in plan.merged_topic_ids:
        exists = db.execute(
            select(word_topics.c.word_id)
            .where(word_topics.c.word_id == canonical.id)
            .where(word_topics.c.topic_id == topic_id)
        ).first()
        if exists is None:
            db.execute(
                word_topics.insert().values(word_id=canonical.id, topic_id=topic_id)
            )

    canonical.knowledge_level = plan.merged_knowledge_level
    canonical.part_of_speech = plan.merged_part_of_speech
    canonical.countability = plan.merged_countability
    canonical.past_simple = plan.merged_past_simple
    canonical.past_participle = plan.merged_past_participle
    canonical.notes = plan.merged_notes
    canonical.pattern = plan.merged_pattern
    canonical.translation_items = []
    canonical.example_items = []
    db.flush()
    sync_word_multivalue_fields(
        canonical,
        plan.merged_translations,
        plan.merged_translation_entries,
        plan.merged_example,
        plan.merged_example_entries,
    )
    db.add(canonical)
    db.flush()

    canonical_queue_ids = {
        queue_id
        for queue_id, in db.execute(
            select(StudyQueueItem.queue_id).where(StudyQueueItem.word_id == canonical.id)
        ).all()
    }
    for duplicate_id in plan.duplicate_ids:
        duplicate_items = db.execute(
            select(StudyQueueItem.id, StudyQueueItem.queue_id)
            .where(StudyQueueItem.word_id == duplicate_id)
            .order_by(StudyQueueItem.id.asc())
        ).all()
        for item_id, queue_id in duplicate_items:
            if int(queue_id) in canonical_queue_ids:
                db.execute(
                    text("DELETE FROM study_queue_items WHERE id = :item_id"),
                    {"item_id": int(item_id)},
                )
            else:
                db.execute(
                    text("UPDATE study_queue_items SET word_id = :word_id WHERE id = :item_id"),
                    {"word_id": int(canonical.id), "item_id": int(item_id)},
                )
                canonical_queue_ids.add(int(queue_id))

        db.execute(
            text("UPDATE word_progress_events SET word_id = :canonical_id WHERE word_id = :duplicate_id"),
            {"canonical_id": int(canonical.id), "duplicate_id": duplicate_id},
        )

    if plan.merged_created_at is not None or plan.merged_updated_at is not None:
        db.execute(
            text(
                "UPDATE words SET created_at = COALESCE(:created_at, created_at), "
                "updated_at = COALESCE(:updated_at, updated_at) "
                "WHERE id = :word_id"
            ),
            {
                "created_at": plan.merged_created_at,
                "updated_at": plan.merged_updated_at,
                "word_id": int(canonical.id),
            },
        )

    db.execute(
        text("DELETE FROM words WHERE id = ANY(:ids)"),
        {"ids": plan.duplicate_ids},
    )


def run(*, apply: bool, allow_singular_conflicts: bool, json_output: Path | None, only_term: str | None) -> int:
    normalized_only_term = normalize_term(only_term) if only_term is not None else None
    with SessionLocal() as db:
        report = _build_report(db, only_term=normalized_only_term)

    duplicate_group_count = report["duplicate_group_count"]
    duplicate_word_count = report["duplicate_word_count"]

    print(f"Found {duplicate_group_count} duplicate term group(s).", flush=True)
    if duplicate_group_count == 0:
        print("Nothing to do.", flush=True)
        if json_output is not None:
            json_output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return 0

    blocked_groups = 0
    applied_groups = 0
    merged_rows = 0
    for group in report["groups"]:
        plan = MergePlan(**group["plan"])
        conflicts = ", ".join(sorted(plan.singular_conflicts)) or "none"
        print(
            f"  term={plan.normalized_term!r} canonical={plan.canonical_id} "
            f"duplicates={plan.duplicate_ids} conflicts={conflicts}",
            flush=True,
        )
        if not apply:
            continue
        if plan.singular_conflicts and not allow_singular_conflicts:
            blocked_groups += 1
            continue
        print(f"    applying merge for {plan.normalized_term!r} ...", flush=True)
        with SessionLocal() as db:
            _apply_merge_plan(db, plan)
            db.commit()
        applied_groups += 1
        merged_rows += len(plan.duplicate_ids)

    if json_output is not None:
        json_output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if apply:
        if blocked_groups:
            print(
                "Apply aborted because some duplicate groups have unresolved singular-field conflicts. "
                "Re-run without --apply to inspect or pass --allow-singular-conflicts.",
                flush=True,
            )
            return 1
        print(f"Merged {merged_rows} duplicate word row(s) across {applied_groups} group(s).", flush=True)
    else:
        print(f"[DRY RUN] Would merge {duplicate_word_count} duplicate word row(s).", flush=True)
        print("Re-run with --apply to commit.", flush=True)

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit and merge duplicate words.")
    parser.add_argument("--apply", action="store_true", help="Commit changes instead of only auditing")
    parser.add_argument(
        "--allow-singular-conflicts",
        action="store_true",
        help="Allow applying groups that disagree on singular fields such as part_of_speech",
    )
    parser.add_argument("--json-output", type=Path, default=None, help="Optional path for a JSON audit report")
    parser.add_argument("--term", default=None, help="Only inspect or merge one normalized term group")
    args = parser.parse_args()
    raise SystemExit(
        run(
            apply=args.apply,
            allow_singular_conflicts=args.allow_singular_conflicts,
            json_output=args.json_output,
            only_term=args.term,
        )
    )


if __name__ == "__main__":
    main()
