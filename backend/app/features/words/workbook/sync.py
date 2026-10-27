"""Plan and apply content-only updates. Transaction ownership stays with the caller."""

from __future__ import annotations

import json
import re
from hashlib import sha256
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

# Register the protected tables even when called from an isolated operator command.
from app.features.smart_review import model as _review_model  # noqa: F401
from app.features.stats import model as _stats_model  # noqa: F401
from app.features.topics.model import Topic
from app.features.words.model import PartsOfSpeech, Word, WordExample, WordTranslation
from app.features.words.repository_queries import with_word_details
from app.features.words.workbook.format import InvalidWorkbookError
from app.features.words.workbook.sync_rows import SyncSource, ordered_unique, parse_examples
from app.shared.db import Base
from app.shared.text import normalize_term

SCALAR_FIELDS = ("term", "definition", "pattern", "countability", "cefr_level", "register", "notes")
CONTENT_FIELDS = {*SCALAR_FIELDS, "part_of_speech", "translations", "examples", "topic_ids"}
PROTECTED_TABLES = (
    "topics",
    "parts_of_speech",
    "word_progress_events",
    "study_queues",
    "study_queue_items",
    "word_verb_forms",
    "word_synonyms",
    "word_antonyms",
    "word_collocations",
    "word_confusables",
    "app_usage_events",
)


def canonical_json(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")


def content_state(word: Word, target_language: str = "ru") -> dict:
    scalars = {name: getattr(word, name) for name in SCALAR_FIELDS}
    if target_language == "en":
        explanations = (word.explanation_groups or {}).get("en", {})
        scalars.update({name: explanations.get(name) for name in ("definition", "notes")})
    return {
        **scalars,
        "part_of_speech": word.part_of_speech.name if word.part_of_speech else None,
        "translations": [item.value for item in word.translation_items if (item.language or "ru") == target_language],
        "examples": [item.value for item in word.example_items],
        "topic_ids": sorted(topic.id for topic in word.topics),
    }


def protected_digest(db: Session) -> str:
    """Hash every progress row and all vocabulary metadata outside the update scope."""
    digest = sha256()
    for name in PROTECTED_TABLES:
        table = Base.metadata.tables[name]
        rows = db.execute(select(table).order_by(*table.primary_key.columns)).mappings().all()
        digest.update(canonical_json([name, [dict(row) for row in rows]]))
    excluded = {*SCALAR_FIELDS, "part_of_speech_id", "updated_at"}
    columns = [column for column in Word.__table__.columns if column.name not in excluded]
    rows = db.execute(select(*columns).order_by(Word.id)).mappings().all()
    digest.update(canonical_json(["protected_word_fields", [dict(row) for row in rows]]))
    return digest.hexdigest()


def merge_examples(incoming: list[str], existing: list[str]) -> list[str]:
    def english_key(value: str) -> str:
        english = value.split("\nRU:", 1)[0].removeprefix("EN:").strip()
        return " ".join(english.casefold().split())

    incoming_keys = {english_key(value) for value in incoming}
    merged = ordered_unique(
        [*incoming, *(value for value in existing if english_key(value) not in incoming_keys)]
    )
    if any(value.startswith(("EN:", "RU:")) for value in merged):
        labelled = [
            value if value.startswith(("EN:", "RU:")) else "EN: " + value for value in merged
        ]
        return parse_examples("\n".join(labelled))
    return merged


def _seal_plan(plan: dict) -> dict:
    plan["summary"]["updated"] = len(plan["changes"])
    plan["plan_sha256"] = sha256(
        canonical_json(
            {key: value for key, value in plan.items() if key not in {"plan_sha256", "mode"}}
        )
    ).hexdigest()
    return plan


def build_sync_plan(
    db: Session, source: SyncSource, *, lock: bool = False, include_related_topics: bool = False
) -> dict:
    topics = {topic.id: topic for topic in db.scalars(select(Topic).where(Topic.language == "en")).all()}
    positions = {pos.name for pos in db.scalars(select(PartsOfSpeech)).all()}
    statement = with_word_details(select(Word).where(Word.language == "en").order_by(Word.id))
    if lock:
        statement = statement.with_for_update(of=Word)
    words = {word.id: word for word in db.scalars(statement).all()}
    plan = {
        "format": "lexora-content-sync-v1",
        "mode": "dry_run",
        "workbook_sha256": source.workbook_sha256,
        "summary": {
            "rows": source.rows,
            "unique_words": len(source.records),
            "sheets": source.sheets,
            "created": 0,
            "updated": 0,
            "unchanged": 0,
            "skipped": 0,
            "conflicting": len({item["word_id"] for item in source.conflicts}),
        },
        "changes": [],
        "conflicts": list(source.conflicts),
        "errors": list(source.errors),
        "normalizations": source.normalizations,
        "topic_annotations": source.topic_annotations,
        "skipped_word_ids": [],
        "unchanged_word_ids": [],
        "topic_suggestions": [],
        "unmatched_topic_labels": [],
        "include_related_topics": include_related_topics,
    }
    blocked = {item.get("word_id") for item in [*source.conflicts, *source.errors]}
    identities = {}
    for word in words.values():
        identities.setdefault(
            (normalize_term(word.term), word.language, word.part_of_speech_id), []
        ).append(word.id)
    pos_ids = {pos.name: pos.id for pos in db.scalars(select(PartsOfSpeech)).all()}
    for word_id, record in sorted(source.records.items()):
        if word_id in blocked:
            plan["skipped_word_ids"].append(word_id)
            continue
        word = words.get(word_id)
        invalid_topics = [
            tid
            for tid in record["topic_ids"]
            if tid not in topics or topics[tid].deleted_at is not None
        ]
        if word is None or word.deleted_at is not None or invalid_topics:
            plan["errors"].append(
                {
                    "word_id": word_id,
                    "error": "Unknown/deleted Word ID or topic ID",
                    "topic_ids": sorted(invalid_topics),
                }
            )
            continue
        before = content_state(word)
        after = {**before}
        values = record["values"]
        for name in SCALAR_FIELDS:
            if name != "notes" and name in values:
                after[name] = values[name]
        if "part_of_speech" in values:
            after["part_of_speech"] = values["part_of_speech"]
        if after["part_of_speech"] is not None and after["part_of_speech"] not in positions:
            plan["errors"].append(
                {"word_id": word_id, "error": "Part of speech is not present in database"}
            )
            continue
        if after["countability"] and after["part_of_speech"] != "noun":
            if "countability" in values:
                plan["errors"].append(
                    {
                        "word_id": word_id,
                        "error": "Conflicting POS/countability; resolve both fields together",
                    }
                )
                continue
            # A verified POS correction makes old noun-only metadata inapplicable.
            if after["part_of_speech"] != before["part_of_speech"]:
                after["countability"] = None
        if "translations" in values:
            after["translations"] = values["translations"]
        if "examples" in values:
            after["examples"] = merge_examples(values["examples"], before["examples"])
        if values.get("notes"):
            after["notes"] = "\n".join(
                ordered_unique([*(before["notes"] or "").splitlines(), *values["notes"]])
            )
        # Only explicit sheet/topic IDs add memberships. Notes never create topics.
        after["topic_ids"] = sorted(set(before["topic_ids"]) | record["topic_ids"])
        for note in values.get("notes", []):
            for related in re.findall(r"(?:^|\|)\s*Related:\s*([^|]+)", note):
                for label in ordered_unique(related.split(",")):
                    matches = [
                        topic
                        for topic in topics.values()
                        if topic.deleted_at is None and topic.name.casefold() == label.casefold()
                    ]
                    if len(matches) != 1:
                        item = {"word_id": word_id, "label": label}
                        if item not in plan["unmatched_topic_labels"]:
                            plan["unmatched_topic_labels"].append(item)
                    elif matches[0].id not in after["topic_ids"]:
                        item = {
                            "word_id": word_id,
                            "topic_id": matches[0].id,
                            "topic_name": matches[0].name,
                        }
                        if item not in plan["topic_suggestions"]:
                            plan["topic_suggestions"].append(item)
                        if include_related_topics:
                            after["topic_ids"] = sorted([*after["topic_ids"], matches[0].id])
        identity = (
            normalize_term(after["term"]),
            word.language,
            pos_ids.get(after["part_of_speech"]),
        )
        old_identity = (normalize_term(before["term"]), word.language, word.part_of_speech_id)
        if identity != old_identity and any(
            other != word_id for other in identities.get(identity, [])
        ):
            plan["conflicts"].append(
                {
                    "word_id": word_id,
                    "field": "identity",
                    "error": "Term/POS correction would collide with another existing Word ID",
                    "other_word_ids": [other for other in identities[identity] if other != word_id],
                }
            )
            plan["skipped_word_ids"].append(word_id)
            continue
        identities.setdefault(identity, []).append(word_id)
        changed = {
            name: {"before": before[name], "after": after[name]}
            for name in CONTENT_FIELDS
            if before[name] != after[name]
        }
        if changed:
            plan["changes"].append({"word_id": word_id, "fields": changed})
        else:
            plan["unchanged_word_ids"].append(word_id)
    plan["summary"]["unchanged"] = len(plan["unchanged_word_ids"])
    plan["summary"]["skipped"] = len(plan["skipped_word_ids"])
    plan["summary"]["conflicting"] = len({item["word_id"] for item in plan["conflicts"]})
    plan["summary"]["invalid"] = len({item.get("word_id") for item in plan["errors"]})
    return _seal_plan(plan)


def write_recovery_snapshot(path: Path, plan: dict) -> str:
    payload = {
        "format": "lexora-content-sync-v1",
        "plan_sha256": plan["plan_sha256"],
        "changes": plan["changes"],
    }
    checksum = sha256(canonical_json(payload)).hexdigest()
    envelope = {"sha256": checksum, "payload": payload}
    # Refuse to overwrite an earlier recovery snapshot.
    with path.open("xb") as stream:
        stream.write(canonical_json(envelope))
        stream.flush()
        import os

        os.fsync(stream.fileno())
    if json.loads(path.read_bytes()) != envelope:
        raise InvalidWorkbookError("Recovery snapshot verification failed")
    return checksum


def apply_sync_plan(db: Session, plan: dict, *, skip_conflicts: bool = False) -> dict:
    if plan["errors"] or (plan["conflicts"] and not skip_conflicts):
        raise InvalidWorkbookError("Unresolved validation errors/conflicts; no changes applied")
    before_digest = protected_digest(db)
    positions = {pos.name: pos for pos in db.scalars(select(PartsOfSpeech)).all()}
    topics = {topic.id: topic for topic in db.scalars(select(Topic).where(Topic.language == "en")).all()}
    ids = [change["word_id"] for change in plan["changes"]]
    words = {
        word.id: word
        for word in db.scalars(
            with_word_details(
                select(Word).where(Word.id.in_(ids), Word.language == "en").with_for_update(of=Word),
            )
        ).all()
    }
    pending_entries = []
    # Validate the complete plan before making any changes.
    for change in plan["changes"]:
        word = words.get(change["word_id"])
        if word is None or word.deleted_at is not None:
            raise InvalidWorkbookError("Word disappeared or was deleted after planning")
        current = content_state(word)
        for name, delta in change["fields"].items():
            if name not in CONTENT_FIELDS or current[name] != delta["before"]:
                raise InvalidWorkbookError(f"Word {word.id} changed after planning; rerun dry-run")
    for change in plan["changes"]:
        word = words[change["word_id"]]
        for name, delta in change["fields"].items():
            value = delta["after"]
            if name == "part_of_speech":
                word.part_of_speech = positions.get(value)
            elif name == "topic_ids":
                word.topics = [topics[tid] for tid in value]
            elif name in {"translations", "examples"}:
                attribute, model = (
                    ("translation_items", WordTranslation)
                    if name == "translations"
                    else ("example_items", WordExample)
                )
                preserved = [item for item in getattr(word, attribute) if name == "translations" and (item.language or "ru") != "ru"]
                setattr(word, attribute, preserved)
                pending_entries.append((word, attribute, model, value))
            else:
                setattr(word, name, value)
    # Delete all old positions before inserting replacements; avoid per-word round trips.
    db.flush()
    for word, attribute, model, values in pending_entries:
        setattr(word, attribute, [*getattr(word, attribute), *[model(position=i, value=value) for i, value in enumerate(values)]])
    db.flush()
    if protected_digest(db) != before_digest:
        raise InvalidWorkbookError(
            "Protected progress or metadata changed; transaction must be rolled back"
        )
    return {
        **plan,
        "mode": "applied",
        "protected_sha256": before_digest,
        "progress_preserved": True,
    }


def build_restore_plan(db: Session, path: Path, *, lock: bool = False) -> dict:
    envelope = json.loads(path.read_bytes())
    payload = envelope["payload"]
    if (
        payload.get("format") != "lexora-content-sync-v1"
        or sha256(canonical_json(payload)).hexdigest() != envelope["sha256"]
    ):
        raise InvalidWorkbookError("Invalid or corrupted recovery snapshot")
    plan = {
        "format": payload["format"],
        "mode": "dry_run",
        "summary": {"updated": 0},
        "changes": [],
        "conflicts": [],
        "errors": [],
    }
    ids = [change["word_id"] for change in payload["changes"]]
    statement = with_word_details(select(Word).where(Word.id.in_(ids), Word.language == "en"))
    if lock:
        statement = statement.with_for_update(of=Word)
    words = {word.id: word for word in db.scalars(statement).all()}
    for original in payload["changes"]:
        word = words.get(original["word_id"])
        if word is None:
            plan["errors"].append({"word_id": original["word_id"], "error": "Word is missing"})
            continue
        current = content_state(word)
        reverse = {}
        for name, delta in original["fields"].items():
            if name not in CONTENT_FIELDS:
                raise InvalidWorkbookError("Recovery snapshot contains a protected field")
            if current[name] == delta["before"]:
                continue
            if current[name] != delta["after"]:
                plan["errors"].append(
                    {
                        "word_id": word.id,
                        "field": name,
                        "error": "Later content edit; automatic rollback refused",
                    }
                )
            reverse[name] = {"before": current[name], "after": delta["before"]}
        if reverse:
            plan["changes"].append({"word_id": word.id, "fields": reverse})
    return _seal_plan(plan)
