from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.features.languages.catalog import learning_language
from app.features.offline.model import OfflineReceipt
from app.features.topics.api import create_topic, restore_topic, update_topic
from app.features.topics.api import delete_topic_checked as delete_topic
from app.features.topics.constants import TOPIC_SLUG_MAX_LEN
from app.features.topics.model import Topic
from app.features.topics.rules import assert_topics_exist
from app.features.topics.schemas import TopicCreate, TopicResponse, TopicUpdate
from app.features.words.api import (
    assert_word_restore_allowed,
    clean_word_entries,
    create_word,
    restore_word,
    soft_delete_word,
    update_word,
    with_word_details,
)
from app.features.words.constants import PROGRESS_SOURCE_SMART_REVIEW, PROGRESS_SOURCE_STUDY_LIST
from app.features.words.model import Word
from app.features.words.schemas import WordCreate, WordResponse, WordUpdate
from app.shared.config import settings
from app.shared.text import slugify


class OfflineChange(BaseModel):
    id: UUID
    entity: Literal["word", "topic"]
    action: Literal["create", "update", "delete", "restore"]
    entity_id: int
    data: dict[str, Any] = Field(default_factory=dict)
    before: dict[str, Any] = Field(default_factory=dict)
    # Deleting/restoring a topic can also change its words. Guard those too.
    affected_words: list[dict[str, Any]] = Field(default_factory=list, max_length=100_000)
    occurred_at: AwareDatetime | None = None

    model_config = ConfigDict(extra="forbid")


RevisionId = Annotated[str, Field(pattern=r"^[1-9][0-9]{0,14}$")]
# An empty digest asks for a fresh copy while still tracking permanent removal.
RevisionDigest = Annotated[str, Field(pattern=r"^(?:[a-f0-9]{64})?$")]


class OfflineRevisions(BaseModel):
    version: int = Field(strict=True, ge=1, le=1)
    word_hashes: dict[RevisionId, RevisionDigest] = Field(max_length=250_000)
    topic_hashes: dict[RevisionId, RevisionDigest] = Field(max_length=250_000)

    model_config = ConfigDict(extra="forbid", strict=True)


def word_data(word: Word) -> dict:
    data = WordResponse.from_word(word).model_dump(mode="json")
    # Retain trashed topic relationships in the replica; normal APIs hide them.
    data["topic_ids"] = sorted(t.id for t in word.topics)
    data["deleted_via_topic_id"] = word.deleted_via_topic_id
    return data


def topic_data(topic: Topic) -> dict:
    return TopicResponse.model_validate(topic).model_dump(mode="json")


def _row_revision(row: dict) -> str:
    content = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def snapshot(db: Session, *, all_languages: bool = False, include_revisions: bool = False) -> dict:
    word_query, topic_query = select(Word), select(Topic)
    if not all_languages:
        word_query = word_query.where(Word.language == learning_language(db))
        topic_query = topic_query.where(Topic.language == learning_language(db))
    words = db.scalars(with_word_details(word_query.order_by(Word.id))).all()
    topics = db.scalars(topic_query.order_by(Topic.id)).all()
    result = {
        "version": 1,
        "words": [word_data(w) for w in words],
        "topics": [topic_data(t) for t in topics],
        "public_config": {"trash_retention_days": settings.trash_retention_days},
    }
    if include_revisions:
        result["revisions"] = {
            "version": 1,
            "word_hashes": {str(row["id"]): _row_revision(row) for row in result["words"]},
            "topic_hashes": {str(row["id"]): _row_revision(row) for row in result["topics"]},
        }
    return result


def _diff_rows(rows: list[dict], previous: dict[str, str]) -> tuple[list[dict], list[int], dict[str, str]]:
    removed = set(previous)
    changed = []
    revisions = {}
    for row in rows:
        id_ = str(row["id"])
        removed.discard(id_)
        digest = _row_revision(row)
        if digest != previous.get(id_):
            changed.append(row)
            revisions[id_] = digest
    return changed, sorted(map(int, removed)), revisions


def delta(db: Session, revisions: OfflineRevisions, *, all_languages: bool = False) -> dict:
    current = snapshot(db, all_languages=all_languages)
    words, removed_words, word_hashes = _diff_rows(current["words"], revisions.word_hashes)
    topics, removed_topics, topic_hashes = _diff_rows(current["topics"], revisions.topic_hashes)
    return {
        "version": 1,
        "words": words,
        "topics": topics,
        "removed_word_ids": removed_words,
        "removed_topic_ids": removed_topics,
        "revisions": {"version": 1, "word_hashes": word_hashes, "topic_hashes": topic_hashes},
        "public_config": current["public_config"],
    }


def comparable(data: dict) -> dict:
    """Dates and derived labels need not match the browser's temporary values."""
    excluded = {
        "created_at",
        "updated_at",
        "example_count",
        "example_target_count",
        "example_status",
        "needs_example_enrichment",
        "deleted_via_topic_id",
        # Import-only reading hints must not invalidate edits from older saved copies.
        "pronunciation_easy",
        "pronunciation_note_ru",
    }
    allowed = set(WordResponse.model_fields) | set(TopicResponse.model_fields)
    result = {key: value for key, value in data.items() if key in allowed and key not in excluded}
    result.setdefault("language", "en")
    if "translation_entries" in data:
        result.setdefault("translation_groups", {"ru": data["translation_entries"]})
        result.setdefault("explanation_groups", {"ru": {"definition": data.get("definition"), "notes": data.get("notes")}})
    result["deleted_at"] = bool(result.get("deleted_at"))
    if "topic_ids" in result:
        # Saved copies created before Favorites existed omit its false default.
        result.setdefault("is_favorite", False)
        result["topic_ids"] = sorted(result["topic_ids"])
    return result


def _desired_update_values(payload: WordUpdate | TopicUpdate) -> dict:
    desired = payload.model_dump(exclude_unset=True, exclude={"progress_source", "translation_language"})
    if isinstance(payload, TopicUpdate):
        if payload.slug is not None:
            desired["slug"] = slugify(payload.slug, max_len=TOPIC_SLUG_MAX_LEN) or payload.slug
        return desired

    for field in ("translation_entries", "example_entries", "synonym_entries", "antonym_entries", "collocation_entries"):
        if field in desired:
            desired[field] = clean_word_entries(desired[field] or [])
    if "confusable_entries" in desired:
        desired["confusable_entries"] = [entry.model_dump() for entry in payload.confusable_entries or []]
    if payload.verb_form is not None:
        desired["verb_form"] = payload.verb_form.model_dump()
    if payload.topic_ids is not None:
        desired["topic_ids"] = sorted(set(payload.topic_ids))
    if "part_of_speech" in desired:
        desired["part_of_speech"] = payload.part_of_speech.lower() if payload.part_of_speech else None
    return desired


def _english_edit_values(row: dict, fields: set[str]) -> dict:
    localized = dict(row)
    if "translation_entries" in fields:
        translations = row.get("translation_groups", {})
        if not isinstance(translations, dict):
            raise HTTPException(422, "Invalid previous translation values")
        localized["translation_entries"] = translations.get("en", [])
    explanation_fields = fields & {"definition", "notes"}
    if explanation_fields:
        groups = row.get("explanation_groups", {})
        english = groups.get("en", {}) if isinstance(groups, dict) else None
        if not isinstance(english, dict):
            raise HTTPException(422, "Invalid previous explanation values")
        localized.update({name: english.get(name) for name in explanation_fields})
    return localized


def _check_before(
    server_item: dict,
    change: OfflineChange,
    payload: WordUpdate | TopicUpdate | None = None,
    *,
    include_conflict_details: bool = False,
) -> set[str]:
    before = dict(change.before)
    if "topic_ids" in before:
        before.setdefault("is_favorite", False)
        if "transliteration" in change.data:
            before.setdefault("transliteration", None)
    desired = _desired_update_values(payload) if payload is not None else {}
    edited_fields = set(desired)
    if payload is not None and (not edited_fields or not edited_fields <= before.keys()):
        raise HTTPException(422, "Offline update must include previous values for every edited field")

    current = server_item
    if isinstance(payload, WordUpdate) and payload.translation_language == "en":
        before = _english_edit_values(before, edited_fields)
        current = _english_edit_values(current, edited_fields)

    expected = comparable(before)
    actual = comparable(current)
    pending = {key for key in edited_fields if desired[key] != actual.get(key)}
    fields = pending | {"deleted_at"} if payload is not None else set(actual)
    mismatches = sorted(key for key in fields if expected.get(key) != actual.get(key))
    if not mismatches:
        return pending
    message = "This item changed on the server. Your offline edits are still saved on this device; review them before syncing."
    if include_conflict_details and change.action == "update" and not server_item.get("deleted_at") and "deleted_at" not in mismatches:
        raise HTTPException(409, {
            "code": "offline_edit_conflict",
            "message": message,
            "change_id": str(change.id),
            "server_item": server_item,
            "fields": [
                {"field": field, "before": expected.get(field), "device": change.data[field], "server": actual.get(field)}
                for field in mismatches
            ],
        })
    raise HTTPException(409, message)


def apply_change(db: Session, change: OfflineChange, *, include_conflict_details: bool = False) -> dict:
    # Preserve hashes for retries of changes accepted before clients sent study time.
    exclude = {"occurred_at"} if change.occurred_at is None else None
    request_hash = hashlib.sha256(
        json.dumps(change.model_dump(mode="json", exclude=exclude), sort_keys=True).encode()
    ).hexdigest()
    receipt_id = str(change.id)
    # Serialize identical retries even when two tabs reconnect together.
    if db.bind.dialect.name == "postgresql":
        lock_id = int.from_bytes(change.id.bytes[:8], "big", signed=True)
        db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": lock_id})
    previous = db.get(OfflineReceipt, receipt_id)
    if previous:
        if previous.payload_hash != request_hash:
            raise HTTPException(409, "Offline operation ID was reused with different content")
        return previous.result

    is_word = change.entity == "word"
    model = Word if is_word else Topic
    serialize = word_data if is_word else topic_data
    if change.action == "create":
        if change.entity_id >= 0:
            raise HTTPException(422, "New offline items require a temporary negative ID")
        if is_word:
            payload = WordCreate.model_validate(change.data)
            if "language" in payload.model_fields_set and payload.language != learning_language(db):
                raise HTTPException(400, "Word language must match the current library")
            assert_topics_exist(db, payload.topic_ids)
            item = create_word(db, payload, commit=False)
        else:
            item = create_topic(db, TopicCreate.model_validate(change.data), commit=False)
    else:
        if change.entity_id <= 0:
            raise HTTPException(422, "Sync the new item before changing it")
        stmt = select(model).where(model.id == change.entity_id, model.language == learning_language(db)).with_for_update()
        if is_word:
            stmt = with_word_details(stmt)
        else:
            stmt = stmt.options(selectinload(Topic.words))
        item = db.scalar(stmt)
        if item is None:
            raise HTTPException(
                409,
                "This item no longer exists on the server. Offline edits remain on this device.",
            )
        update = None
        if change.action == "update":
            update = (WordUpdate if is_word else TopicUpdate).model_validate(change.data)
        fields = _check_before(serialize(item), change, update, include_conflict_details=include_conflict_details)
        if isinstance(update, WordUpdate):
            if update.language is not None and update.language != item.language:
                raise HTTPException(400, "Words cannot be moved between languages")
            if "topic_ids" in fields and update.topic_ids is not None:
                assert_topics_exist(db, update.topic_ids)
            occurred_at = None
            if update.knowledge_level is not None and update.progress_source in (
                PROGRESS_SOURCE_STUDY_LIST, PROGRESS_SOURCE_SMART_REVIEW
            ):
                # A separate study operation is an attempt, even when the rating already matches.
                fields.add("knowledge_level")
                if change.occurred_at is not None:
                    occurred_at = min(change.occurred_at.astimezone(UTC), datetime.now(UTC))
            if fields:
                word_update = WordUpdate.model_validate(update.model_dump(
                    include=fields | {"progress_source", "translation_language"}, exclude_unset=True,
                ))
                item = update_word(db, item, word_update, commit=False, occurred_at=occurred_at)
        elif isinstance(update, TopicUpdate):
            if "name" in fields and update.slug is not None:
                # An explicit slug suppresses the rename's automatic slug generation.
                fields.add("slug")
            if fields:
                topic_update = TopicUpdate.model_validate(update.model_dump(include=fields, exclude_unset=True))
                item = update_topic(db, item, topic_update, commit=False)
        elif is_word:
            if change.data:
                raise HTTPException(422, "Unexpected word delete/restore options")
            if change.action == "delete":
                item = soft_delete_word(db, item, commit=False)
            else:
                if not any(t.deleted_at is None for t in item.topics):
                    raise HTTPException(409, "Restore a topic before restoring this word")
                assert_word_restore_allowed(db, item)
                item = restore_word(db, item, commit=False)
        else:
            allowed = "delete_words" if change.action == "delete" else "restore_words"
            if set(change.data) - {allowed} or (
                allowed in change.data and not isinstance(change.data[allowed], bool)
            ):
                raise HTTPException(422, "Invalid topic delete/restore options")
            words = db.scalars(
                with_word_details(
                    select(Word).where(Word.topics.any(Topic.id == item.id)).with_for_update()
                )
            ).all()
            current = sorted((comparable(word_data(w)) for w in words), key=lambda w: w["id"])
            expected = sorted((comparable(w) for w in change.affected_words), key=lambda w: w["id"])
            if current != expected:
                raise HTTPException(
                    409,
                    "Words in this topic changed on the server. Your offline changes remain saved.",
                )
            if change.action == "delete":
                item = delete_topic(
                    db, item, delete_words=change.data.get(allowed, False), commit=False
                )
            else:
                item = restore_topic(
                    db, item, restore_words=change.data.get(allowed, False), commit=False
                )

    result = {"entity_id": item.id, "item": serialize(item)}
    db.add(OfflineReceipt(id=receipt_id, payload_hash=request_hash, result=result))
    # Content, progress history and receipt are one atomic transaction.
    db.commit()
    return result
