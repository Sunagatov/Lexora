"""The data migration preserves identities and history while retiring Basic."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from app.features.smart_review.service import _level_buckets
from app.features.words.schemas import WordCreate, WordUpdate
from app.features.words.workbook.workbook_styling import _add_validations, _create_lists_sheet
from app.scripts.xlsx_mapping import parse_knowledge_level
from openpyxl import Workbook


def test_legacy_api_and_spreadsheet_inputs_become_okay():
    assert WordCreate(term="word", topic_ids=[1], knowledge_level=2).knowledge_level == 3
    assert WordUpdate(knowledge_level=2).knowledge_level == 3
    assert parse_knowledge_level(2, sheet_name="Words", row_number=2) == 3
    for invalid in (0, 6):
        with pytest.raises(ValidationError):
            WordUpdate(knowledge_level=invalid)


def test_review_quota_is_preserved_when_basic_and_okay_are_combined():
    from app.features.smart_review.service import settings

    buckets = _level_buckets()
    assert set(buckets) == {1, 3, 4, 5}
    assert buckets[3] == settings.smart_review_level_2_count + settings.smart_review_level_3_count
    assert sum(buckets.values()) == sum([
        settings.smart_review_level_1_count, settings.smart_review_level_2_count,
        settings.smart_review_level_3_count, settings.smart_review_level_4_count,
        settings.smart_review_level_5_count,
    ])


def test_export_validation_offers_only_the_four_current_categories():
    workbook = Workbook()
    sheet = workbook.active
    _create_lists_sheet(workbook)
    _add_validations(workbook, sheet, 3)
    assert [workbook["Lists"].cell(row=i, column=1).value for i in range(1, 5)] == ["1", "3", "4", "5"]
    validation = next(v for v in sheet.data_validations.dataValidation if str(v.sqref) == "A2:A3")
    assert validation.formula1 == "=Lists!$A$1:$A$4"


def test_migration_preserves_words_history_and_queue_membership():
    path = Path(__file__).parents[3] / "alembic/versions/20261017_0011_merge_basic_into_okay.py"
    spec = spec_from_file_location("knowledge_merge", path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as db:
        db.execute(text("CREATE TABLE words (id INTEGER PRIMARY KEY, knowledge_level INTEGER, term TEXT, deleted_at TEXT, CONSTRAINT ck_words_knowledge_level CHECK (knowledge_level BETWEEN 1 AND 5))"))
        db.execute(text("CREATE TABLE word_progress_events (id INTEGER PRIMARY KEY, word_id INTEGER REFERENCES words(id), old_level INTEGER, new_level INTEGER, source TEXT, created_at TEXT)"))
        db.execute(text("CREATE TABLE study_queue_items (id INTEGER PRIMARY KEY, word_id INTEGER REFERENCES words(id), is_completed BOOLEAN)"))
        db.execute(text("INSERT INTO words VALUES (11, 2, 'basic', NULL), (12, 3, 'okay', NULL), (13, 2, 'deleted', '2026-10-01'), (14, 1, 'weak', NULL), (15, 4, 'strong', NULL), (16, 5, 'parked', NULL), (17, NULL, 'unrated', NULL)"))
        db.execute(text("INSERT INTO word_progress_events VALUES (21, 11, 1, 2, 'manual', '2026-10-01'), (22, 12, 2, 3, 'study_list', '2026-10-02'), (23, 13, 2, 2, 'manual', '2026-10-03')"))
        db.execute(text("INSERT INTO study_queue_items VALUES (31, 11, TRUE), (32, 12, FALSE)"))
        before_words = db.execute(text("SELECT id, term, deleted_at FROM words ORDER BY id")).all()
        before_history = db.execute(text("SELECT id, word_id, source, created_at FROM word_progress_events ORDER BY id")).all()
        before_queue = db.execute(text("SELECT * FROM study_queue_items ORDER BY id")).all()
        with Operations.context(MigrationContext.configure(db)):
            migration.upgrade()
        assert db.execute(text("SELECT id, knowledge_level FROM words ORDER BY id")).all() == [(11, 3), (12, 3), (13, 3), (14, 1), (15, 4), (16, 5), (17, None)]
        assert db.execute(text("SELECT old_level, new_level FROM word_progress_events ORDER BY id")).all() == [(1, 3), (3, 3), (3, 3)]
        assert db.execute(text("SELECT id, term, deleted_at FROM words ORDER BY id")).all() == before_words
        assert db.execute(text("SELECT id, word_id, source, created_at FROM word_progress_events ORDER BY id")).all() == before_history
        assert db.execute(text("SELECT * FROM study_queue_items ORDER BY id")).all() == before_queue
        with pytest.raises(IntegrityError, match="CHECK constraint failed"):
            db.execute(text("UPDATE words SET knowledge_level=2 WHERE id=11"))
        with Operations.context(MigrationContext.configure(db)):
            migration.downgrade()
        # A schema downgrade does not guess which Okay ratings used to be Basic.
        assert db.scalar(text("SELECT knowledge_level FROM words WHERE id=11")) == 3
    engine.dispose()
