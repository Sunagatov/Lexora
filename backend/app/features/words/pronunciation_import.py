"""Content-only import of reviewed pronunciation hints, matched by stable identity."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.features.topics.model import Topic  # noqa: F401 — register Word.topics for standalone imports.
from app.features.words.model import Word


class PronunciationImportError(ValueError):
    pass


class PronunciationEntry(BaseModel):
    word_id: int = Field(strict=True, gt=0)
    language: Literal["es"]
    term: str = Field(min_length=1, max_length=255)
    part_of_speech: str | None
    pronunciation_easy: str | None = Field(max_length=1000)
    pronunciation_note_ru: str | None = Field(max_length=2000)
    status: Literal["ready", "needs_review"]
    issue: str | None

    model_config = ConfigDict(extra="forbid")


def digest(value) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()


def read_package(data_path: Path, manifest_path: Path) -> tuple[list[PronunciationEntry], dict]:
    raw = data_path.read_bytes()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    if manifest.get("format_version") != "lexora-easy-pronunciation-v1":
        raise PronunciationImportError("Unsupported pronunciation package")
    if hashlib.sha256(raw).hexdigest() != manifest.get("output", {}).get("sha256"):
        raise PronunciationImportError("Pronunciation file does not match the manifest checksum")
    languages = manifest.get("languages", {})
    if set(languages) != {"es"} or languages["es"].get("scheme") != "russian-cyrillic-v1":
        raise PronunciationImportError("Expected Spanish Russian-letter pronunciation hints")
    entries = [
        PronunciationEntry.model_validate_json(line)
        for line in raw.decode("utf-8-sig").splitlines()
        if line.strip()
    ]
    if not entries or len(entries) != languages["es"].get("unique_output_word_ids"):
        raise PronunciationImportError("Package count does not match the manifest")
    if len({r.word_id for r in entries}) != len(entries):
        raise PronunciationImportError("Duplicate Word IDs in pronunciation package")
    for row in entries:
        if (
            row.status != "ready"
            or row.issue
            or not row.pronunciation_easy
            or not row.pronunciation_easy.strip()
        ):
            raise PronunciationImportError(f"Word ID {row.word_id} still requires review")
    return entries, manifest


def build_plan(db: Session, entries: list[PronunciationEntry], *, lock: bool = False) -> dict:
    query = select(Word).where(Word.id.in_([r.word_id for r in entries])).order_by(Word.id)
    if lock:
        query = query.with_for_update(of=Word)
    words = {w.id: w for w in db.scalars(query.execution_options(populate_existing=True)).unique()}
    changes, errors, unchanged = [], [], 0
    for row in sorted(entries, key=lambda r: r.word_id):
        word = words.get(row.word_id)
        if word is None or word.deleted_at is not None or not word.is_active:
            errors.append(f"Word ID {row.word_id} is missing or unavailable")
            continue
        if (
            word.language,
            word.term,
            word.part_of_speech.name if word.part_of_speech else None,
        ) != (row.language, row.term, row.part_of_speech):
            errors.append(f"Word ID {row.word_id} identity changed")
            continue
        before = {
            "pronunciation_easy": word.pronunciation_easy,
            "pronunciation_note_ru": word.pronunciation_note_ru,
        }
        after = {
            "pronunciation_easy": row.pronunciation_easy,
            "pronunciation_note_ru": row.pronunciation_note_ru,
        }
        if before == after:
            unchanged += 1
        elif any(value is not None for value in before.values()):
            errors.append(f"Word ID {row.word_id} already has different pronunciation hints")
        else:
            changes.append(
                {"word_id": row.word_id, "term": row.term, "before": before, "after": after}
            )
    plan = {
        "changes": changes,
        "errors": errors,
        "summary": {"update": len(changes), "unchanged": unchanged, "conflicts": len(errors)},
        "package_sha256": digest([r.model_dump() for r in entries]),
    }
    return {**plan, "plan_sha256": digest(plan)}


def apply_plan(db: Session, entries: list[PronunciationEntry], expected_plan: str) -> dict:
    plan = build_plan(db, entries, lock=True)
    if plan["errors"] or plan["plan_sha256"] != expected_plan:
        raise PronunciationImportError(
            "The reviewed plan changed or contains conflicts; run a fresh preview"
        )
    for change in plan["changes"]:
        # Deliberately bypass ORM onupdate: this import changes only these two columns.
        db.execute(
            text(
                "UPDATE words SET pronunciation_easy=:pronunciation_easy, pronunciation_note_ru=:pronunciation_note_ru WHERE id=:id"
            ),
            {**change["after"], "id": change["word_id"]},
        )
    db.expire_all()
    return plan
