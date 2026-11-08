"""Auth tables are additive and never rewrite vocabulary or learning progress."""

import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def auth_migration(connection):
    spec = importlib.util.spec_from_file_location(
        "auth_migration",
        Path(__file__).resolve().parents[1] / "alembic/versions/20261107_0017_auth_sessions.py",
    )
    change = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(change)
    change.op = Operations(MigrationContext.configure(connection))
    return change


def test_auth_migration_preserves_existing_data_in_both_directions():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE words (id INTEGER PRIMARY KEY, knowledge_level INTEGER)"))
        connection.execute(text("INSERT INTO words VALUES (42, 4)"))
        connection.execute(text("CREATE TABLE app_preferences (id INTEGER PRIMARY KEY, value TEXT)"))
        connection.execute(text("INSERT INTO app_preferences VALUES (1, 'keep')"))
        # The shared production schema already contains another app's sessions.
        connection.execute(text("CREATE TABLE auth_sessions (id INTEGER PRIMARY KEY, token TEXT)"))
        connection.execute(text("INSERT INTO auth_sessions VALUES (7, 'other-app')"))
        change = auth_migration(connection)
        change.upgrade()
        assert {"lexora_auth_sessions", "lexora_auth_login_attempts"}.issubset(inspect(connection).get_table_names())
        change.downgrade()
        assert connection.execute(text("SELECT * FROM words")).all() == [(42, 4)]
        assert connection.execute(text("SELECT * FROM app_preferences")).all() == [(1, "keep")]
        assert connection.execute(text("SELECT * FROM auth_sessions")).all() == [(7, "other-app")]
        assert set(inspect(connection).get_table_names()) == {"words", "app_preferences", "auth_sessions"}
    engine.dispose()
