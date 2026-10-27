"""Apply a saved preview atomically, with stale checks and a durable recovery receipt."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.features.languages.catalog import learning_language, translation_language
from app.features.topics.model import Topic
from app.features.words.domain import lock_word_identities
from app.features.words.model import PartsOfSpeech, Word, WordExample, WordTranslation
from app.features.words.repository_queries import with_word_details
from app.features.words.workbook.format import InvalidWorkbookError
from app.features.words.workbook.import_models import WorkbookImportBatch
from app.features.words.workbook.import_plan import build_import_plan
from app.features.words.workbook.sync import canonical_json


class StaleImportError(Exception):
    pass


def preview_import(db: Session, source: dict, *, mode: str, minimum_translations: int) -> dict:
    plan = build_import_plan(db, source, mode=mode, minimum_translations=minimum_translations)
    batch_id = None
    if not plan["errors"]:
        db.execute(
            delete(WorkbookImportBatch).where(
                WorkbookImportBatch.result.is_(None),
                WorkbookImportBatch.created_at < datetime.now(UTC) - timedelta(days=7),
            )
        )
        batch_id = str(uuid4())
        db.add(
            WorkbookImportBatch(id=batch_id, plan_hash=plan["plan_hash"], source=source, plan=plan)
        )
        db.commit()
    return {**plan, "batch_id": batch_id}


def apply_import(db: Session, batch_id: str, expected_hash: str) -> dict:
    # Serialize imports (including separate previews of the same file) on PostgreSQL.
    lock_word_identities(db)
    batch = db.scalar(
        select(WorkbookImportBatch).where(WorkbookImportBatch.id == batch_id).with_for_update()
    )
    if batch is None:
        raise InvalidWorkbookError("Import preview not found; upload the file again")
    if (batch.plan.get("language", "en"), batch.plan.get("translation_language", "ru")) != (learning_language(db), translation_language(db)):
        raise StaleImportError("This preview belongs to a different language; switch back or preview again")
    if batch.plan_hash != expected_hash:
        raise StaleImportError("The preview does not match; preview the file again")
    if batch.result is not None:
        return {**batch.result, "replayed": True}
    created_at = (
        batch.created_at.replace(tzinfo=UTC)
        if batch.created_at.tzinfo is None
        else batch.created_at
    )
    if datetime.now(UTC) - created_at > timedelta(days=1):
        raise StaleImportError("Preview expired; preview the file again")
    fresh = build_import_plan(
        db,
        batch.source,
        mode=batch.plan["mode"],
        minimum_translations=batch.plan["minimum_translations"],
        lock=True,
    )
    if fresh["plan_hash"] != batch.plan_hash or fresh["errors"]:
        raise StaleImportError("Vocabulary changed after preview; preview again before applying")
    topics = {str(topic.id): topic for topic in db.scalars(select(Topic).where(Topic.language == learning_language(db))).all()}
    for item in fresh["topics"]:
        topic = Topic(**item, language=learning_language(db), is_active=True)
        db.add(topic)
        topics["new:" + topic.name.casefold()] = topic
    positions = {pos.name: pos for pos in db.scalars(select(PartsOfSpeech)).all()}
    ids = [entry["word_id"] for entry in fresh["entries"] if entry["word_id"] is not None]
    words = (
        {
            word.id: word
            for word in db.scalars(with_word_details(select(Word).where(Word.id.in_(ids)))).all()
        }
        if ids
        else {}
    )
    pending_entries, created = [], []
    for entry in fresh["entries"]:
        if entry["action"] == "unchanged":
            continue
        after = entry["after"]
        if entry["action"] == "create":
            word = Word(language=learning_language(db), knowledge_level=1, is_active=True, source="import")
            db.add(word)
            created.append(word)
        else:
            word = words[entry["word_id"]]
        for name in (
            "term",
            "definition",
            "pattern",
            "countability",
            "cefr_level",
            "register",
            "notes",
        ):
            if name in ("definition", "notes") and translation_language(db) == "en":
                groups = word.explanation_groups or {}
                word.explanation_groups = {**groups, "en": {**groups.get("en", {}), name: after[name]}}
            else:
                setattr(word, name, after[name])
        word.part_of_speech = positions.get(after["part_of_speech"])
        word.topics = [topics[ref] for ref in after["topic_ids"]]
        for name, model, values in (
            ("translation_items", WordTranslation, after["translations"]),
            ("example_items", WordExample, after["examples"]),
        ):
            existing = getattr(word, name)
            selected = [item for item in existing if name != "translation_items" or (item.language or "ru") == translation_language(db)]
            if [item.value for item in selected] != values:
                setattr(word, name, [item for item in existing if item not in selected])
                pending_entries.append((word, name, model, values))
    db.flush()  # Remove old positions before inserting replacements, once for the whole batch.
    for word, name, model, values in pending_entries:
        options = {"language": translation_language(db)} if name == "translation_items" else {}
        getattr(word, name).extend(model(position=index, value=value, **options) for index, value in enumerate(values))
    db.flush()
    result = {
        "batch_id": batch.id,
        **fresh["summary"],
        "created_word_ids": [word.id for word in created],
        "created_topic_ids": [topic.id for key, topic in topics.items() if key.startswith("new:")],
        "progress_preserved": True,
        "replayed": False,
    }
    batch.result = result
    db.commit()  # Vocabulary and receipt commit together; retry cannot duplicate a completed batch.
    return result


def recovery_record(db: Session, batch_id: str) -> dict:
    batch = db.get(WorkbookImportBatch, batch_id)
    if batch is None or batch.result is None:
        raise InvalidWorkbookError("Completed import not found")
    if (batch.plan.get("language", "en"), batch.plan.get("translation_language", "ru")) != (learning_language(db), translation_language(db)):
        raise InvalidWorkbookError("This import belongs to a different language")
    payload = {
        "format": "lexora-workbook-import-v1",
        "language": learning_language(db),
        "translation_language": translation_language(db),
        "batch_id": batch.id,
        "plan_hash": batch.plan_hash,
        "changes": [entry for entry in batch.plan["entries"] if entry["action"] == "update"],
        "created_word_ids": batch.result["created_word_ids"],
        "created_topic_ids": batch.result["created_topic_ids"],
    }
    return {"sha256": sha256(canonical_json(payload)).hexdigest(), "payload": payload}
