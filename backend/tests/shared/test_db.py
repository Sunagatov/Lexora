from types import SimpleNamespace

from sqlalchemy.exc import OperationalError

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


def test_ensure_database_schema_creates_tables_once(monkeypatch) -> None:
    calls: list[object] = []
    sqlite_engine = SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))

    monkeypatch.setattr(db, "USING_SQLITE_FALLBACK", True)
    monkeypatch.setattr(db, "engine", sqlite_engine)
    monkeypatch.setattr(db, "_sqlite_schema_ready", False)
    monkeypatch.setattr(db.Base.metadata, "create_all", lambda bind: calls.append(bind))

    db.ensure_database_schema()
    db.ensure_database_schema()

    assert calls == [sqlite_engine]
