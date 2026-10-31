"""Exercise the additive migration against a disposable pre-feature schema."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_preferences_migration_preserves_words_progress_and_links_and_guards_rollback():
    spec = importlib.util.spec_from_file_location(
        "preferences_migration", Path("alembic/versions/20261031_0016_preferences_favorites.py")
    )
    change = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(change)
    engine = create_engine("sqlite://")
    with engine.begin() as db:
        db.execute(
            text("CREATE TABLE words (id INTEGER PRIMARY KEY, term TEXT, knowledge_level INTEGER)")
        )
        db.execute(text("CREATE TABLE word_topics (word_id INTEGER, topic_id INTEGER)"))
        db.execute(text("CREATE TABLE word_progress_events (word_id INTEGER, new_level INTEGER)"))
        db.execute(text("INSERT INTO words VALUES (20, 'patient', 4)"))
        db.execute(text("INSERT INTO word_topics VALUES (20, 10)"))
        db.execute(text("INSERT INTO word_progress_events VALUES (20, 4)"))
        change.op = Operations(MigrationContext.configure(db))
        change.upgrade()
        assert db.execute(text("SELECT * FROM words")).one() == (20, "patient", 4, 0)
        assert db.execute(text("SELECT * FROM word_topics")).one() == (20, 10)
        assert db.execute(text("SELECT * FROM word_progress_events")).one() == (20, 4)
        db.execute(text("UPDATE words SET is_favorite = 1"))
        with pytest.raises(RuntimeError, match="Preserve favorites"):
            change.downgrade()
        db.execute(text("UPDATE words SET is_favorite = 0"))
        db.execute(text("INSERT INTO app_preferences (id, \"values\") VALUES (1, '{}')"))
        with pytest.raises(RuntimeError, match="Preserve favorites"):
            change.downgrade()
        db.execute(text("DELETE FROM app_preferences"))
        change.downgrade()
        assert "app_preferences" not in inspect(db).get_table_names()
        assert db.execute(text("SELECT * FROM words")).one() == (20, "patient", 4)
    engine.dispose()
