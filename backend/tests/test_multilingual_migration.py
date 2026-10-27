"""Run the actual migration in both directions against a disposable database."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.features.smart_review import model as _queues  # noqa: F401
from app.features.stats import model as _stats  # noqa: F401
from app.features.topics import model as _topics  # noqa: F401
from app.features.words import model as _words  # noqa: F401
from app.features.words import progress as _progress  # noqa: F401
from app.shared.db import Base
from sqlalchemy import create_engine, inspect, text


def migration(connection):
    path = Path("alembic/versions/20261027_0013_multilingual.py")
    spec = importlib.util.spec_from_file_location("multilingual_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(connection))
    return module


def test_migration_preserves_english_ids_progress_and_content_and_guards_downgrade():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with engine.begin() as db:
        change = migration(db)
        # Recreate the old schema from an empty current schema first.
        change.downgrade()
        assert "ix_words_language" in {index["name"] for index in inspect(db).get_indexes("words")}
        assert "language" not in {column["name"] for column in inspect(db).get_columns("topics")}
        db.execute(text("INSERT INTO topics (id,name,slug) VALUES (10,'People','people')"))
        db.execute(text("INSERT INTO words (id,term,language,knowledge_level,is_active,definition) VALUES (20,'patient','en',4,1,'Able to wait')"))
        db.execute(text("INSERT INTO word_topics VALUES (20,10)"))
        db.execute(text("INSERT INTO word_translations (word_id,position,value) VALUES (20,0,'терпеливый')"))
        db.execute(text("INSERT INTO word_progress_events (word_id,old_level,new_level,source) VALUES (20,1,4,'manual')"))
        change.upgrade()
        assert db.execute(text("SELECT id,term,language,knowledge_level,definition FROM words")).one() == (20, 'patient', 'en', 4, 'Able to wait')
        assert db.execute(text("SELECT word_id,language,value FROM word_translations")).one() == (20, 'ru', 'терпеливый')
        assert db.execute(text("SELECT language FROM topics")).scalar_one() == 'en'
        assert db.execute(text("SELECT word_id,new_level FROM word_progress_events")).one() == (20, 4)
        assert db.execute(text("SELECT * FROM word_topics")).one() == (20, 10)
        # The original English-only data can safely return to its old schema.
        change.downgrade()
        change.upgrade()
        db.execute(text("INSERT INTO topics (id,name,slug,language) VALUES (11,'People','people','zh')"))
        db.execute(text("INSERT INTO words (id,term,language,is_active,transliteration) VALUES (21,'你好','zh',1,'nǐ hǎo')"))
        db.execute(text("INSERT INTO word_translations (word_id,position,value,language) VALUES (20,0,'patient','en')"))
        with pytest.raises(RuntimeError, match="Multilingual data exists"):
            change.downgrade()
        assert db.execute(text("SELECT count(*) FROM words")).scalar_one() == 2
    engine.dispose()
