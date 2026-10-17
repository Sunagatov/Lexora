from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.features.offline.model import OfflineReceipt
from app.features.offline.router import sync_change
from app.features.offline.service import OfflineChange, apply_change, snapshot, word_data
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic
from app.features.words.model import Word
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


def test_retry_does_not_duplicate_progress_or_receipts(db):
    edit = change(db)
    first = apply_change(db, edit)
    assert apply_change(db, edit) == first
    assert db.scalar(select(func.count()).select_from(WordProgressEvent)) == 1
    assert db.scalar(select(func.count()).select_from(OfflineReceipt)) == 1
    assert db.get(Word, 1).knowledge_level == 4


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


def test_offline_routes_require_both_session_and_csrf(db):
    from fastapi.testclient import TestClient
    from jose import jwt

    from app.main import app
    from app.shared.auth import ALGORITHM, SESSION_SUBJECT_OWNER, build_csrf_token
    from app.shared.config import settings
    from app.shared.deps import get_db

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        assert client.get("/api/offline/snapshot").status_code == 401
        assert client.post("/api/offline/changes", json={}).status_code == 401
        token = jwt.encode({"sub": SESSION_SUBJECT_OWNER}, settings.secret_key, algorithm=ALGORITHM)
        client.cookies.set("session", token)
        assert client.get("/api/offline/snapshot").status_code == 403
        response = client.get(
            "/api/offline/snapshot",
            headers={"X-CSRF-Token": build_csrf_token(settings.secret_key, token)},
        )
        assert response.status_code == 200
        assert response.json()["words"][0]["term"] == "patient"
    finally:
        app.dependency_overrides.pop(get_db, None)
