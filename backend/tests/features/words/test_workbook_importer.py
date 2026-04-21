from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

from openpyxl import Workbook
import pytest

from app.features.topics.model import Topic
from app.features.words.workbook import importer as workbook_importer


class TopicStub:
    def __init__(self, topic_id: int, name: str):
        self.id = topic_id
        self.name = name
        self.deleted_at = None
        self.is_active = True


def _make_topic(topic_id=1, name="Animals") -> Topic:
    return TopicStub(topic_id, name)  # type: ignore[return-value]


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


def test_import_words_workbook_prefers_meta_topic_id(monkeypatch) -> None:
    db = MagicMock()
    topic = _make_topic(topic_id=77, name="Renamed Topic")

    workbook = Workbook()
    ws = workbook.active
    ws.title = "Travel"
    ws.append(["Knowledge", "Word", "Russian translations"])
    ws.append([1, "ticket", "билет"])
    meta = workbook.create_sheet("__lexora_meta")
    meta.append(["sheet_name", "topic_id", "topic_name", "exported_at"])
    meta.append(["Travel", 77, "Renamed Topic", "2026-01-01T12:00:00+00:00"])

    buffer = BytesIO()
    workbook.save(buffer)

    seen: list[tuple[str, int | None, str | None]] = []

    monkeypatch.setattr(workbook_importer, "_get_topic", lambda db_arg, topic_name, topic_id=None: seen.append((topic_name, topic_id, topic.name)) or topic)
    monkeypatch.setattr(
        workbook_importer,
        "_import_sheet",
        lambda db_arg, ws_arg, header_map_arg, topic_arg, seen_existing_words_arg=None: workbook_importer.WorkbookImportSheetSummary(
            sheet_name=ws_arg.title,
            topic_name=topic_arg.name,
            created=0,
            updated=0,
            skipped=0,
        ),
    )

    result = workbook_importer.import_words_workbook(db, buffer.getvalue())

    assert result.sheets[0].topic_name == "Renamed Topic"
    assert seen == [("Renamed Topic", 77, "Renamed Topic")]


def test_import_sheet_allows_identical_shared_word_updates_across_sheets(monkeypatch) -> None:
    topic = _make_topic()
    db = MagicMock()
    existing = _make_existing_word(word_id=10, term="cat", topic_id=1)
    _patch_sheet_deps(monkeypatch, find_existing_returns=existing)

    header_map = {"word_id": 1, "term": 2, "translations": 3, "examples": 4}
    first_sheet = _FakeWs("Animals A", [{1: 10, 2: "cat", 3: "кошка", 4: "Cat is a pet."}])
    second_sheet = _FakeWs("Animals B", [{1: 10, 2: "cat", 3: "кошка", 4: "Cat is a pet."}])
    seen_existing_words: dict[int, tuple[str, tuple[object, ...]]] = {}

    first_summary = workbook_importer._import_sheet(
        db,
        first_sheet,
        header_map,
        topic,
        seen_existing_words,
    )
    second_summary = workbook_importer._import_sheet(
        db,
        second_sheet,
        header_map,
        topic,
        seen_existing_words,
    )

    assert first_summary.updated == 1
    assert second_summary.updated == 1
    assert seen_existing_words[10][0] == "Animals A"
    assert db.flush.call_count == 2


def test_import_sheet_rejects_conflicting_shared_word_updates_across_sheets(monkeypatch) -> None:
    topic = _make_topic()
    db = MagicMock()
    existing = _make_existing_word(word_id=10, term="cat", topic_id=1)
    _patch_sheet_deps(monkeypatch, find_existing_returns=existing)

    header_map = {"word_id": 1, "term": 2, "translations": 3, "examples": 4}
    first_sheet = _FakeWs("Animals A", [{1: 10, 2: "cat", 3: "кошка", 4: "Cat is a pet."}])
    second_sheet = _FakeWs("Animals B", [{1: 10, 2: "cat", 3: "кошка", 4: "Cat is a domestic animal."}])
    seen_existing_words: dict[int, tuple[str, tuple[object, ...]]] = {}

    workbook_importer._import_sheet(
        db,
        first_sheet,
        header_map,
        topic,
        seen_existing_words,
    )

    with pytest.raises(workbook_importer.InvalidWorkbookError) as exc_info:
        workbook_importer._import_sheet(
            db,
            second_sheet,
            header_map,
            topic,
            seen_existing_words,
        )

    assert "conflicting values" in str(exc_info.value)
