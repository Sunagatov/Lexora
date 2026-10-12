from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

import app.features.topics.model  # register the current schema
import app.features.words.model  # noqa: F401 - register the current schema
from app.shared import db


def test_build_engine_falls_back_to_sqlite_when_postgres_is_unreachable(monkeypatch) -> None:
    sqlite_engine = object()

    monkeypatch.setattr(db, "_build_postgres_engine", lambda: object())
    monkeypatch.setattr(
        db,
        "_probe_engine",
        lambda _: (_ for _ in ()).throw(OperationalError("SELECT 1", {}, Exception("boom"))),
    )
    monkeypatch.setattr(db, "_build_sqlite_engine", lambda: sqlite_engine)

    assert db.build_engine() is sqlite_engine


def test_build_engine_does_not_switch_to_an_empty_database_in_production(monkeypatch) -> None:
    monkeypatch.setattr(db.settings, "app_debug", False)
    monkeypatch.setattr(db, "_build_postgres_engine", lambda: object())
    monkeypatch.setattr(
        db, "_probe_engine",
        lambda _: (_ for _ in ()).throw(OperationalError("SELECT 1", {}, Exception("boom"))),
    )
    monkeypatch.setattr(db, "_build_sqlite_engine", lambda: pytest.fail("Production used SQLite"))
    with pytest.raises(OperationalError):
        db.build_engine()


def test_ensure_database_schema_creates_tables_once(monkeypatch) -> None:
    calls: list[object] = []
    sqlite_engine = SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))

    monkeypatch.setattr(db, "USING_SQLITE_FALLBACK", True)
    monkeypatch.setattr(db, "engine", sqlite_engine)
    monkeypatch.setattr(db, "_sqlite_schema_ready", False)
    monkeypatch.setattr(db, "_sqlite_schema_has_drift", lambda candidate: False)
    monkeypatch.setattr(db.Base.metadata, "create_all", lambda bind: calls.append(bind))

    db.ensure_database_schema()
    db.ensure_database_schema()

    assert calls == [sqlite_engine]


def test_ensure_database_schema_preserves_stale_sqlite_data(monkeypatch, tmp_path) -> None:
    sqlite_path = tmp_path / "lexora-local.sqlite3"
    original_engine = create_engine(f"sqlite+pysqlite:///{sqlite_path}")

    with original_engine.begin() as connection:
        connection.execute(text("CREATE TABLE words (id INTEGER PRIMARY KEY, term TEXT NOT NULL)"))
        connection.execute(text("INSERT INTO words (id, term) VALUES (1, 'kept')"))

    monkeypatch.setattr(db, "USING_SQLITE_FALLBACK", True)
    monkeypatch.setattr(db, "engine", original_engine)
    monkeypatch.setattr(db, "_sqlite_schema_ready", False)
    monkeypatch.setattr(db, "_sqlite_database_path", lambda: sqlite_path)

    with pytest.raises(RuntimeError, match="schema"):
        db.ensure_database_schema()

    assert db.engine is original_engine
    assert sqlite_path.exists()
    with original_engine.connect() as connection:
        assert connection.scalar(text("SELECT term FROM words WHERE id = 1")) == "kept"
    original_engine.dispose()
