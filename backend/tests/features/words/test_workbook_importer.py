from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.words.workbook import importer as workbook_importer


def _make_topic(topic_id=1, name="Animals"):
    return SimpleNamespace(id=topic_id, name=name, deleted_at=None, is_active=True)


def _make_existing_word(word_id=10, term="cat", topic_id=1):
    topic = _make_topic(topic_id=topic_id)
    return SimpleNamespace(
        id=word_id,
        term=term,
        translations="кошка",
        topics=[topic],
        knowledge_level=1,
        countability=None,
        part_of_speech=None,
        past_simple=None,
        past_participle=None,
        pattern=None,
        notes=None,
        example=None,
        example_items=[],
        translation_items=[],
        is_active=True,
        deleted_at=None,
        updated_at=None,
    )


class _FakeWs:
    """Minimal worksheet double: 2 data rows."""
    def __init__(self, title, rows):
        self.title = title
        self.sheet_state = "visible"
        # rows: list of dicts {col_idx: value}
        self._rows = rows
        self.max_row = len(rows) + 1  # +1 for header

    def cell(self, row, column):
        if row == 1:
            return None
        data = self._rows[row - 2]
        value = data.get(column)
        return SimpleNamespace(value=value)


# ---------------------------------------------------------------------------
# flush is called after each add
# ---------------------------------------------------------------------------

def _patch_sheet_deps(monkeypatch, *, find_existing_returns=None, should_validate=False):
    """Apply all the monkeypatches needed to run _import_sheet without a real DB or ORM."""
    monkeypatch.setattr(workbook_importer, "_find_existing_word",
                        lambda db, topic_id, word_id, term: find_existing_returns)
    monkeypatch.setattr(workbook_importer, "assert_no_duplicate_word",
                        lambda term, existing_terms: None)
    monkeypatch.setattr(
        workbook_importer,
        "existing_normalized_terms",
        lambda db_arg, topic_ids, exclude_word_id=None: set(),
    )
    monkeypatch.setattr(workbook_importer, "sync_word_multivalue_fields",
                        lambda *args, **kwargs: None)
    monkeypatch.setattr(workbook_importer, "_should_validate_existing_word_duplicate",
                        lambda existing, term, topic_was_missing: should_validate)
    monkeypatch.setattr(workbook_importer, "record_level_change",
                        lambda *args, **kwargs: None)
    # Replace Word class so SQLAlchemy relationship validation is skipped
    monkeypatch.setattr(workbook_importer, "Word",
                        lambda **kwargs: SimpleNamespace(**{k: v for k, v in kwargs.items() if k != "topics"}))


def test_import_sheet_flushes_after_adding_new_word(monkeypatch) -> None:
    """db.flush() must be called once for each newly created word."""
    topic = _make_topic()
    db = MagicMock()
    _patch_sheet_deps(monkeypatch)

    header_map = {"term": 1, "translations": 2}
    ws = _FakeWs("Animals", [{1: "cat", 2: "кошка"}])

    workbook_importer._import_sheet(db, ws, header_map, topic)

    db.add.assert_called_once()
    db.flush.assert_called_once()


def test_import_sheet_flushes_after_updating_existing_word(monkeypatch) -> None:
    """db.flush() must be called once when updating an existing word."""
    topic = _make_topic()
    db = MagicMock()
    existing = _make_existing_word(term="cat")
    _patch_sheet_deps(monkeypatch, find_existing_returns=existing)

    header_map = {"term": 1, "translations": 2}
    ws = _FakeWs("Animals", [{1: "cat", 2: "кошка updated"}])

    workbook_importer._import_sheet(db, ws, header_map, topic)

    db.add.assert_called_once()
    db.flush.assert_called_once()


def test_import_sheet_flush_called_for_each_row(monkeypatch) -> None:
    """Two new words → db.flush() called twice."""
    topic = _make_topic()
    db = MagicMock()
    _patch_sheet_deps(monkeypatch)

    header_map = {"term": 1, "translations": 2}
    ws = _FakeWs("Animals", [
        {1: "cat", 2: "кошка"},
        {1: "dog", 2: "собака"},
    ])

    workbook_importer._import_sheet(db, ws, header_map, topic)

    assert db.flush.call_count == 2
