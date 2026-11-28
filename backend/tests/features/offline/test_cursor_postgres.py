import os
import runpy
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.features.auth.service import create_session
from app.features.offline.cursor import CatalogChangeRequest
from app.features.offline.router import get_cursor_changes, get_snapshot
from app.features.topics.model import Topic
from app.features.words.model import PartsOfSpeech, Word, WordExample
from app.main import app
from app.shared.auth import build_csrf_token
from app.shared.config import settings
from app.shared.db import Base
from app.shared.deps import get_db

MIGRATION = Path(__file__).resolve().parents[3] / "alembic/versions/20261128_0018_offline_cursor.py"


def _migrate(engine, action):
    migration = runpy.run_path(str(MIGRATION))
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        migration[action]()


@pytest.fixture
def catalog_engine():
    port = os.environ.get("LEXORA_REVIEW_TEST_POSTGRES_PORT")
    if not port:
        pytest.skip("Disposable PostgreSQL port not supplied")
    assert port.isdecimal() and 1024 <= int(port) <= 65535
    url = f"postgresql+psycopg://lexora_review_test:local-test-only@127.0.0.1:{port}/lexora_review_test"
    schema = "offline_cursor_" + uuid4().hex
    root = create_engine(url)
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with root.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        Base.metadata.create_all(engine)
        _migrate(engine, "upgrade")
        yield engine
    finally:
        engine.dispose()
        with root.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        root.dispose()


def _snapshot(engine):
    with Session(engine) as db:
        return get_snapshot(db, all_languages=True, include_cursor=True)


def _changes(engine, cursor):
    with Session(engine) as db:
        return get_cursor_changes(CatalogChangeRequest.model_validate({"cursor": cursor}), db)


def test_cursor_does_not_skip_a_repeatable_read_writer_that_commits_later(catalog_engine):
    with Session(catalog_engine) as db, db.begin():
        first = Word(term="cursor first")
        second = Word(term="cursor second", language="es")
        db.add_all([first, second])
        db.flush()
        first_id, second_id = first.id, second.id
    initial = _snapshot(catalog_engine)["cursor"]

    def update_definition(connection, word_id, definition):
        connection.execute(text("SET LOCAL statement_timeout = 5000"))
        connection.execute(
            text("UPDATE words SET definition = :definition WHERE id = :word_id"),
            {"word_id": word_id, "definition": definition},
        )

    with catalog_engine.connect().execution_options(isolation_level="REPEATABLE READ") as older, older.begin():
        update_definition(older, first_id, "Written first, committed last")
        with catalog_engine.connect().execution_options(isolation_level="REPEATABLE READ") as newer, newer.begin():
            update_definition(newer, second_id, "Written last, committed first")
        between = _changes(catalog_engine, initial)
        assert [row["id"] for row in between["words"]] == [second_id]

    after = _changes(catalog_engine, between["cursor"])
    assert [row["id"] for row in after["words"]] == [first_id]
    assert int(initial["revision"]) < int(between["cursor"]["revision"]) < int(after["cursor"]["revision"])

    with catalog_engine.connect() as connection:
        rolled_back = connection.begin()
        update_definition(connection, first_id, "Discarded edit")
        connection.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        rolled_back.rollback()
    unchanged = _changes(catalog_engine, after["cursor"])
    assert unchanged["cursor"] == after["cursor"]
    assert unchanged["words"] == []


def test_cursor_routes_include_related_rows_and_purges_and_fall_back_after_migration_rollback(
    catalog_engine, auth_db
):
    def catalog_db():
        with Session(catalog_engine) as db:
            yield db

    with Session(catalog_engine) as db, db.begin():
        topic = Topic(name="Cursor topic", slug="cursor-topic")
        pos = PartsOfSpeech(name="cursor adjective")
        word = Word(term="cursor patient", topics=[topic], part_of_speech=pos)
        db.add(word)
        db.flush()
        word_id, topic_id, pos_id = word.id, topic.id, pos.id

    token = create_session(auth_db)
    headers = {"X-CSRF-Token": build_csrf_token(settings.secret_key, token), "X-Lexora-All-Languages": "true"}
    app.dependency_overrides[get_db] = catalog_db
    try:
        client = TestClient(app)
        client.cookies.set("session", token)
        response = client.get("/api/offline/snapshot?include_cursor=true&include_revisions=true", headers=headers)
        assert response.status_code == 200
        baseline = response.json()
        assert "revisions" not in baseline
        assert baseline["words"][0]["id"] == word_id

        with Session(catalog_engine) as db, db.begin():
            db.add(WordExample(word_id=word_id, position=0, value="Please be patient."))
            db.get(PartsOfSpeech, pos_id).name = "renamed cursor adjective"

        response = client.post("/api/offline/cursor", headers=headers, json={"cursor": baseline["cursor"]})
        assert response.status_code == 200
        changed = response.json()
        assert [row["id"] for row in changed["words"]] == [word_id]
        assert changed["words"][0]["example_entries"] == ["Please be patient."]
        assert changed["words"][0]["part_of_speech"] == "renamed cursor adjective"
        assert changed["words"][0]["updated_at"] == baseline["words"][0]["updated_at"]
        assert changed["topics"] == []

        with Session(catalog_engine) as db, db.begin():
            db.delete(db.get(Word, word_id))
            db.flush()
            db.delete(db.get(Topic, topic_id))
            db.add(Word(term="catalog row survives migration rollback"))

        response = client.post("/api/offline/cursor", headers=headers, json={"cursor": changed["cursor"]})
        assert response.status_code == 200
        purged = response.json()
        assert purged["removed_word_ids"] == [word_id]
        assert purged["removed_topic_ids"] == [topic_id]

        _migrate(catalog_engine, "downgrade")
        response = client.post("/api/offline/cursor", headers=headers, json={"cursor": purged["cursor"]})
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "offline_cursor_reseed"

        response = client.get("/api/offline/snapshot?include_cursor=true&include_revisions=true", headers=headers)
        assert response.status_code == 200
        fallback = response.json()
        assert "cursor" not in fallback
        assert fallback["words"][0]["term"] == "catalog row survives migration rollback"
        response = client.post("/api/offline/delta", headers=headers, json=fallback["revisions"])
        assert response.status_code == 200
        assert response.json()["words"] == []
    finally:
        app.dependency_overrides.pop(get_db, None)
