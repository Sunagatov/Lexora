"""Exercise the legacy database constraint that blocked the PostgreSQL rehearsal."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError


def test_legacy_source_check_accepts_starter_markers_without_changing_existing_rows():
    spec = importlib.util.spec_from_file_location(
        "starter_source_migration", Path("alembic/versions/20261027_0014_starter_sources.py")
    )
    change = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(change)
    engine = create_engine("sqlite://")
    with engine.begin() as db:
        db.execute(text("CREATE TABLE words (id INTEGER PRIMARY KEY, term TEXT NOT NULL, source VARCHAR(10) NOT NULL, knowledge_level INTEGER, CONSTRAINT ck_words_source CHECK (source IN ('manual','import')))"))
        db.execute(text("INSERT INTO words VALUES (42,'patient','import',4)"))
        change.op = Operations(MigrationContext.configure(db))
        change.upgrade()
        assert db.execute(text("SELECT * FROM words")).one() == (42, "patient", "import", 4)
        db.execute(text("INSERT INTO words VALUES (43,'你好','start1s001',1)"))
        with pytest.raises(IntegrityError), db.begin_nested():
            db.execute(text("INSERT INTO words VALUES (44,'invalid','unknown',1)"))
        with pytest.raises(RuntimeError, match="Starter entries exist"):
            change.downgrade()
        assert db.execute(text("SELECT source FROM words WHERE id=43")).scalar_one() == "start1s001"
        db.execute(text("DELETE FROM words WHERE id=43"))
        change.downgrade()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.execute(text("INSERT INTO words VALUES (43,'你好','start1s001',1)"))
        assert db.execute(text("SELECT * FROM words")).one() == (42, "patient", "import", 4)
    engine.dispose()
