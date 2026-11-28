import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.features.offline.model import OfflineReceipt
from app.features.offline.router import sync_change
from app.features.offline.service import (
    OfflineChange,
    OfflineRevisions,
    apply_change,
    delta,
    snapshot,
    word_data,
)
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic
from app.features.words.model import Word, WordExample
from app.features.words.progress import WordProgressEvent
from app.features.words.repository import create_word, update_word
from app.features.words.schemas import WordCreate, WordUpdate
from app.shared.db import Base


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        topic = create_topic(session, TopicCreate(name="People"))
        create_word(
            session,
            WordCreate(
                term="patient",
                topic_ids=[topic.id],
                knowledge_level=1,
                translation_entries=["терпеливый", "выдержанный"],
            ),
        )
        yield session
    engine.dispose()


def change(db, **values):
    data = snapshot(db)
    defaults = {
        "id": uuid4(),
        "entity": "word",
        "action": "update",
        "entity_id": data["words"][0]["id"],
        "before": data["words"][0],
        "data": {"knowledge_level": 4},
    }
    return OfflineChange(**(defaults | values))


def test_snapshot_opt_in_preserves_legacy_shape_and_has_empty_delta_when_current(db):
    legacy = snapshot(db)
    assert set(legacy) == {"version", "words", "topics", "public_config"}
    versioned = snapshot(db, include_revisions=True)
    revisions = OfflineRevisions.model_validate(versioned.pop("revisions"))
    assert versioned == legacy
    assert set(revisions.word_hashes) == {str(word["id"]) for word in legacy["words"]}
    assert set(revisions.topic_hashes) == {str(topic["id"]) for topic in legacy["topics"]}

    assert delta(db, revisions) == {
        "version": 1,
        "words": [],
        "topics": [],
        "removed_word_ids": [],
        "removed_topic_ids": [],
        "revisions": {"version": 1, "word_hashes": {}, "topic_hashes": {}},
        "public_config": legacy["public_config"],
    }


def test_delta_includes_child_only_update_without_a_word_timestamp_change(db):
    baseline = snapshot(db, include_revisions=True)
    word = baseline["words"][0]
    db.add(WordExample(word_id=word["id"], position=0, value="Please be patient."))
    db.commit()
    db.expire_all()

    updated = delta(db, OfflineRevisions.model_validate(baseline["revisions"]))
    assert [row["id"] for row in updated["words"]] == [word["id"]]
    assert updated["words"][0]["updated_at"] == word["updated_at"]
    assert updated["words"][0]["example_entries"] == ["Please be patient."]
    assert updated["revisions"]["word_hashes"][str(word["id"])] != baseline["revisions"]["word_hashes"][str(word["id"])]
    assert updated["topics"] == []
    assert updated["removed_word_ids"] == []


def test_delta_reports_purged_words_and_topics(db):
    baseline = snapshot(db, include_revisions=True)
    word_id = baseline["words"][0]["id"]
    topic_id = baseline["topics"][0]["id"]
    db.delete(db.get(Word, word_id))
    db.flush()
    db.delete(db.get(Topic, topic_id))
    db.commit()

    removed = delta(db, OfflineRevisions.model_validate(baseline["revisions"]))
    assert removed["words"] == []
    assert removed["topics"] == []
    assert removed["removed_word_ids"] == [word_id]
    assert removed["removed_topic_ids"] == [topic_id]
    assert removed["revisions"] == {"version": 1, "word_hashes": {}, "topic_hashes": {}}


def test_empty_revision_forces_authoritative_refresh_or_removal(db):
    baseline = snapshot(db, include_revisions=True)
    word = baseline["words"][0]
    topic = baseline["topics"][0]
    unknown_word_id = word["id"] + 100
    revisions = OfflineRevisions.model_validate({
        "version": 1,
        "word_hashes": {str(word["id"]): "", str(unknown_word_id): ""},
        "topic_hashes": {str(topic["id"]): ""},
    })

    refreshed = delta(db, revisions)
    assert refreshed["words"] == [word]
    assert refreshed["topics"] == [topic]
    assert refreshed["removed_word_ids"] == [unknown_word_id]
    assert refreshed["removed_topic_ids"] == []
    assert refreshed["revisions"] == baseline["revisions"]


def test_retry_does_not_duplicate_progress_or_receipts(db):
    edit = change(db)
    first = apply_change(db, edit)
    assert apply_change(db, edit) == first
    assert db.scalar(select(func.count()).select_from(WordProgressEvent)) == 1
    assert db.scalar(select(func.count()).select_from(OfflineReceipt)) == 1
    assert db.get(Word, 1).knowledge_level == 4


@pytest.mark.parametrize("source", ["study_list", "smart_review"])
def test_offline_review_uses_practice_date_after_delayed_sync_and_retry(db, source):
    edit = change(db, data={"knowledge_level": 1, "progress_source": source},
                  occurred_at="2026-01-05T23:00:00-05:00")

    result = apply_change(db, edit)
    assert apply_change(db, edit) == result

    event = db.scalars(select(WordProgressEvent)).one()
    receipt = db.scalars(select(OfflineReceipt)).one()
    assert (event.old_level, event.new_level, event.source) == (1, 1, source)
    assert event.created_at.replace(tzinfo=UTC) == datetime(2026, 1, 6, 4, tzinfo=UTC)
    assert receipt.created_at > event.created_at


@pytest.mark.parametrize(
    ("source", "client_time_offset"),
    [("study_list", timedelta(minutes=2)), ("manual", -timedelta(days=2))],
)
def test_offline_rating_uses_sync_time_for_forward_clock_or_manual_rating(db, source, client_time_offset):
    before_sync = datetime.now(UTC)
    edit = change(db, data={"knowledge_level": 4, "progress_source": source},
                  occurred_at=before_sync + client_time_offset)
    apply_change(db, edit)

    event = db.scalars(select(WordProgressEvent)).one()
    assert before_sync.replace(microsecond=0) <= event.created_at.replace(tzinfo=UTC) <= datetime.now(UTC)


def test_offline_change_rejects_timestamp_without_timezone(db):
    with pytest.raises(ValidationError, match="timezone"):
        change(db, occurred_at="2026-01-05T23:00:00")


def test_offline_retry_accepts_receipt_created_before_client_timestamps(db):
    edit = change(db)
    legacy_payload = edit.model_dump(mode="json", exclude={"occurred_at"})
    legacy_hash = hashlib.sha256(json.dumps(legacy_payload, sort_keys=True).encode()).hexdigest()
    result = {"entity_id": edit.entity_id}
    db.add(OfflineReceipt(id=str(edit.id), payload_hash=legacy_hash, result=result))
    db.commit()

    assert apply_change(db, edit) == result
    assert db.scalar(select(func.count()).select_from(WordProgressEvent)) == 0


def test_retry_of_create_returns_same_server_id(db):
    edit = change(
        db,
        action="create",
        entity_id=-1,
        before={},
        data={"term": "calm", "topic_ids": [1], "knowledge_level": 1},
    )
    result = apply_change(db, edit)
    assert result["entity_id"] > 0
    assert apply_change(db, edit) == result
    assert db.scalar(select(func.count()).select_from(Word)) == 2


def test_uuid_cannot_be_reused_for_different_content(db):
    edit = change(db)
    apply_change(db, edit)
    edit.data = {"knowledge_level": 5}
    with pytest.raises(HTTPException) as error:
        sync_change(edit, db)
    assert error.value.status_code == 409
    assert db.get(Word, 1).knowledge_level == 4


def test_newer_server_rating_is_not_overwritten(db):
    edit = change(db)
    update_word(db, db.get(Word, 1), WordUpdate(knowledge_level=3))
    with pytest.raises(HTTPException) as error:
        sync_change(edit, db)
    assert error.value.status_code == 409
    assert db.get(Word, 1).knowledge_level == 3
    assert db.scalar(select(func.count()).select_from(OfflineReceipt)) == 0


def test_update_conflict_can_include_field_values_and_a_canonical_edit_base(db):
    edit = change(db, data={"translation_entries": ["терпеливый с детьми"], "translation_language": "ru"})
    update_word(db, db.get(Word, 1), WordUpdate(translation_entries=["терпеливый человек"]))

    with pytest.raises(HTTPException) as legacy:
        apply_change(db, edit)
    assert legacy.value.status_code == 409
    assert isinstance(legacy.value.detail, str)
    with pytest.raises(HTTPException) as conflict:
        apply_change(db, edit, include_conflict_details=True)
    assert conflict.value.status_code == 409
    detail = conflict.value.detail
    assert detail["code"] == "offline_edit_conflict"
    assert detail["change_id"] == str(edit.id)
    assert detail["server_item"]["id"] == edit.entity_id
    assert detail["fields"] == [{
        "field": "translation_entries",
        "before": ["терпеливый", "выдержанный"],
        "device": ["терпеливый с детьми"],
        "server": ["терпеливый человек"],
    }]
    assert db.scalar(select(func.count()).select_from(OfflineReceipt)) == 0
    retry = edit.model_copy(update={"id": uuid4(), "before": detail["server_item"]})
    assert apply_change(db, retry)["entity_id"] == edit.entity_id
    assert snapshot(db)["words"][0]["translation_entries"] == ["терпеливый с детьми"]


def test_unrelated_server_edit_does_not_block_rating(db):
    edit = change(db)
    update_word(db, db.get(Word, 1), WordUpdate(notes="New server note"))
    apply_change(db, edit)
    assert db.get(Word, 1).notes == "New server note"
    assert db.get(Word, 1).knowledge_level == 4


def test_missing_before_values_cannot_bypass_conflict_check(db):
    edit = change(db, before={})
    with pytest.raises(HTTPException) as error:
        sync_change(edit, db)
    assert error.value.status_code == 422


@pytest.mark.parametrize("action,data", [("delete", {}), ("update", {"is_favorite": True})])
def test_legacy_offline_created_word_can_be_deleted_or_favorited(db, action, data):
    created = apply_change(db, change(
        db, action="create", entity_id=-2, before={},
        data={"term": "calm", "topic_ids": [1], "translation_entries": ["calm translation"]},
    ))
    before = dict(created["item"])
    # Already-queued edits from older copies omit the false Favorites default.
    before.pop("is_favorite")
    edit = change(db, action=action, entity_id=created["entity_id"], before=before, data=data)
    result = apply_change(db, edit)
    if action == "delete":
        assert result["item"]["deleted_at"] is not None
    else:
        assert result["item"]["is_favorite"] is True
    assert apply_change(db, edit) == result


def test_legacy_favorite_default_still_detects_a_newer_server_favorite(db):
    before = snapshot(db)["words"][0]
    before.pop("is_favorite")
    update_word(db, db.get(Word, 1), WordUpdate(is_favorite=True))
    with pytest.raises(HTTPException) as error:
        sync_change(change(db, action="delete", before=before, data={}), db)
    assert error.value.status_code == 409
    assert db.get(Word, 1).is_favorite is True
    assert db.get(Word, 1).deleted_at is None


def test_legacy_favorite_default_does_not_allow_a_missing_previous_word(db):
    with pytest.raises(HTTPException) as error:
        sync_change(change(db, before={}, data={"is_favorite": True}), db)
    assert error.value.status_code == 422


def test_topic_delete_accepts_legacy_word_snapshots_without_favorites(db):
    saved = snapshot(db)
    for word in saved["words"]:
        word.pop("is_favorite")
    apply_change(db, change(
        db, entity="topic", action="delete", data={},
        before=saved["topics"][0], affected_words=saved["words"],
    ))
    assert db.get(Topic, 1).deleted_at is not None
    assert db.get(Word, 1).deleted_at is not None


def test_receipt_and_content_are_atomic(db, monkeypatch):
    edit = change(db)

    def fail_commit():
        db.flush()
        raise RuntimeError("Simulated lost transaction")

    monkeypatch.setattr(db, "commit", fail_commit)
    with pytest.raises(RuntimeError):
        apply_change(db, edit)
    db.rollback()
    assert db.get(Word, 1).knowledge_level == 1
    assert db.scalar(select(func.count()).select_from(OfflineReceipt)) == 0
    assert db.scalar(select(func.count()).select_from(WordProgressEvent)) == 0


def test_delete_topic_refuses_to_delete_newer_word_changes(db):
    data = snapshot(db)
    edit = change(
        db,
        entity="topic",
        action="delete",
        entity_id=1,
        data={"delete_words": True},
        before=data["topics"][0],
        affected_words=data["words"],
    )
    update_word(db, db.get(Word, 1), WordUpdate(knowledge_level=4))
    with pytest.raises(HTTPException) as error:
        sync_change(edit, db)
    assert error.value.status_code == 409
    assert db.get(Topic, 1).deleted_at is None
    assert db.get(Word, 1).deleted_at is None


def test_delete_restore_preserves_ids_translations_and_topic_links(db):
    delete = change(db, action="delete", data={})
    apply_change(db, delete)
    data = snapshot(db)
    assert data["words"][0]["topic_ids"] == [1]
    restored = apply_change(db, change(db, action="restore", data={}))
    assert restored["entity_id"] == 1
    assert restored["item"]["deleted_at"] is None
    assert restored["item"]["translation_entries"] == ["терпеливый", "выдержанный"]


def test_topic_create_then_word_create_then_edit(db):
    topic = apply_change(
        db,
        change(
            db,
            entity="topic",
            action="create",
            entity_id=-1,
            data={"name": "Travel", "parent_topic_id": 1},
            before={},
        ),
    )
    word = apply_change(
        db,
        change(
            db,
            action="create",
            entity_id=-2,
            data={"term": "journey", "topic_ids": [topic["entity_id"]]},
            before={},
        ),
    )
    edit = change(
        db,
        entity_id=word["entity_id"],
        before=word["item"],
        data={"translation_entries": ["путешествие", "поездка"]},
    )
    result = apply_change(db, edit)
    assert result["item"]["topic_ids"] == [topic["entity_id"]]
    assert result["item"]["translation_entries"] == ["путешествие", "поездка"]


def test_topic_delete_and_restore_includes_exclusive_words(db):
    data = snapshot(db)
    apply_change(
        db,
        change(
            db,
            entity="topic",
            action="delete",
            data={},
            before=data["topics"][0],
            affected_words=data["words"],
        ),
    )
    data = snapshot(db)
    assert data["words"][0]["deleted_at"]
    assert data["words"][0]["topic_ids"] == [1]
    apply_change(
        db,
        change(
            db,
            entity="topic",
            action="restore",
            data={"restore_words": True},
            before=data["topics"][0],
            affected_words=data["words"],
        ),
    )
    assert word_data(db.get(Word, 1))["deleted_at"] is None


def test_topic_delete_after_synced_rating_ignores_client_only_metadata(db):
    apply_change(db, change(db, data={"knowledge_level": 4, "progress_source": "study_list"}))
    data = snapshot(db)
    data["words"][0]["progress_source"] = "study_list"
    data["words"][0]["source"] = "manual"
    apply_change(
        db,
        change(
            db,
            entity="topic",
            action="delete",
            data={},
            before=data["topics"][0],
            affected_words=data["words"],
        ),
    )
    assert db.get(Word, 1).deleted_at is not None


def test_offline_routes_require_both_session_and_csrf(db, auth_db):
    from fastapi.testclient import TestClient

    from app.features.auth.service import create_session
    from app.main import app
    from app.shared.auth import build_csrf_token
    from app.shared.config import settings
    from app.shared.deps import get_db

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        assert client.get("/api/offline/snapshot").status_code == 401
        assert client.post("/api/offline/changes", json={}).status_code == 401
        assert client.post("/api/offline/delta", json={}).status_code == 401
        token = create_session(auth_db)
        client.cookies.set("session", token)
        assert client.get("/api/offline/snapshot").status_code == 403
        assert client.post("/api/offline/delta", json={}).status_code == 403
        headers = {"X-CSRF-Token": build_csrf_token(settings.secret_key, token)}
        response = client.get(
            "/api/offline/snapshot?include_revisions=true",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["words"][0]["term"] == "patient"
        revisions = response.json()["revisions"]
        response = client.post("/api/offline/delta", headers=headers, json=revisions)
        assert response.status_code == 200
        assert response.json()["words"] == []
    finally:
        app.dependency_overrides.pop(get_db, None)
