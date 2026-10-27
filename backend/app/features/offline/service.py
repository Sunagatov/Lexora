from __future__ import annotations

import hashlib
import json
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.features.languages.catalog import learning_language
from app.features.offline.model import OfflineReceipt
from app.features.topics.api import create_topic, restore_topic, update_topic
from app.features.topics.api import delete_topic_checked as delete_topic
from app.features.topics.model import Topic
from app.features.topics.rules import assert_topics_exist
from app.features.topics.schemas import TopicCreate, TopicResponse, TopicUpdate
from app.features.words.api import (
    assert_word_restore_allowed,
    create_word,
    restore_word,
    soft_delete_word,
    update_word,
    with_word_details,
)
from app.features.words.model import Word
from app.features.words.schemas import WordCreate, WordResponse, WordUpdate
from app.shared.config import settings


class OfflineChange(BaseModel):
    id: UUID
    entity: Literal["word", "topic"]
    action: Literal["create", "update", "delete", "restore"]
    entity_id: int
    data: dict[str, Any] = Field(default_factory=dict)
    before: dict[str, Any] = Field(default_factory=dict)
    # Deleting/restoring a topic can also change its words. Guard those too.
    affected_words: list[dict[str, Any]] = Field(default_factory=list, max_length=100_000)

    model_config = ConfigDict(extra="forbid")


def word_data(word: Word) -> dict:
    data = WordResponse.from_word(word).model_dump(mode="json")
    # Retain trashed topic relationships in the replica; normal APIs hide them.
    data["topic_ids"] = sorted(t.id for t in word.topics)
    data["deleted_via_topic_id"] = word.deleted_via_topic_id
    return data


def topic_data(topic: Topic) -> dict:
    return TopicResponse.model_validate(topic).model_dump(mode="json")


def snapshot(db: Session, *, all_languages: bool = False) -> dict:
    word_query, topic_query = select(Word), select(Topic)
    if not all_languages:
        word_query = word_query.where(Word.language == learning_language(db))
        topic_query = topic_query.where(Topic.language == learning_language(db))
    words = db.scalars(with_word_details(word_query.order_by(Word.id))).all()
    topics = db.scalars(topic_query.order_by(Topic.id)).all()
    return {
        "version": 1,
        "words": [word_data(w) for w in words],
        "topics": [topic_data(t) for t in topics],
        "public_config": {"trash_retention_days": settings.trash_retention_days},
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
    }
    allowed = set(WordResponse.model_fields) | set(TopicResponse.model_fields)
    result = {key: value for key, value in data.items() if key in allowed and key not in excluded}
    result.setdefault("language", "en")
    if "translation_entries" in data:
        result.setdefault("translation_groups", {"ru": data["translation_entries"]})
        result.setdefault("explanation_groups", {"ru": {"definition": data.get("definition"), "notes": data.get("notes")}})
    result["deleted_at"] = bool(result.get("deleted_at"))
    if "topic_ids" in result:
        result["topic_ids"] = sorted(result["topic_ids"])
    return result


def _check_before(current: dict, change: OfflineChange) -> None:
    current = dict(current)
    if "transliteration" in change.data and "transliteration" not in change.before:
        change = change.model_copy(update={"before": {**change.before, "transliteration": None}})
    target = change.data.get("translation_language", "ru")
    if target == "en":
        for field in ("definition", "notes"):
            if field in change.data:
                current[field] = current.get("explanation_groups", {}).get("en", {}).get(field)
                change = change.model_copy(update={"before": {**change.before, field: change.before.get("explanation_groups", {}).get("en", {}).get(field)}})
    if target != "ru" and "translation_entries" in change.data:
        current["translation_entries"] = current.get("translation_groups", {}).get(target, [])
        before = dict(change.before)
        before["translation_entries"] = before.get("translation_groups", {}).get(target, [])
        change = change.model_copy(update={"before": before})
    expected = comparable(change.before)
    actual = comparable(current)
    if change.action == "update":
        fields = set(change.data) - {"progress_source", "translation_language"}
        if not fields or not fields <= change.before.keys():
            raise HTTPException(
                422, "Offline update must include previous values for every edited field"
            )
        fields.add("deleted_at")
    else:
        fields = set(actual)
    if any(expected.get(key) != actual.get(key) for key in fields):
        raise HTTPException(
            409,
            "This item changed on the server. Your offline edits are still saved on this device; review them before syncing.",
        )


def apply_change(db: Session, change: OfflineChange) -> dict:
    request_hash = hashlib.sha256(
        json.dumps(change.model_dump(mode="json"), sort_keys=True).encode()
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
        _check_before(serialize(item), change)
        if change.action == "update":
            if is_word:
                payload = WordUpdate.model_validate(change.data)
                if payload.language is not None and payload.language != item.language:
                    raise HTTPException(400, "Words cannot be moved between languages")
                if payload.topic_ids is not None:
                    assert_topics_exist(db, payload.topic_ids)
                item = update_word(db, item, payload, commit=False)
            else:
                item = update_topic(db, item, TopicUpdate.model_validate(change.data), commit=False)
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
