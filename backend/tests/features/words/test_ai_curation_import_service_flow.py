from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.features.words.ai_curation import service as ai_curation_service
from app.features.words.ai_curation.schemas import AiCurationImportRequest, CreateTopicOperation
from app.features.words.ai_curation.service import AiCurationImportError


def _make_topic(id=1, name="Banking", slug="banking", deleted_at=None):
    return SimpleNamespace(id=id, name=name, slug=slug, description=None, is_active=True, deleted_at=deleted_at)


def _make_word(id=10, term="mortgage", topics=None, translation_items=None, example_items=None):
    topic = _make_topic()
    return SimpleNamespace(
        id=id,
        term=term,
        translations="ипотека",
        translation_items=translation_items or [],
        example_items=example_items or [],
        topics=topics if topics is not None else [topic],
        countability=None,
        part_of_speech=None,
        past_simple=None,
        past_participle=None,
        pattern=None,
        notes=None,
        knowledge_level=None,
        is_active=True,
        deleted_at=None,
    )


def test_import_rollback_on_failure(monkeypatch) -> None:
    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    def boom(db, payload, commit=True):
        raise RuntimeError("DB exploded")

    monkeypatch.setattr(ai_curation_service, "create_word", boom)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[
            {
                "op": "create_new_word",
                "target_topic_refs": [{"topic_id": 1}],
                "term": "bond",
                "translations": "облигация",
            }
        ],
    )

    import pytest

    with pytest.raises(RuntimeError):
        ai_curation_service.import_ai_curation(db, payload)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_full_import_flow_all_operation_types(monkeypatch) -> None:
    source = _make_topic(id=1, name="Banking")
    narrower = _make_topic(id=55, name="Retail Banking")
    word_a = _make_word(id=10, term="mortgage")
    word_b = _make_word(id=20, term="overdraft")
    new_word = _make_word(id=111, term="collateral")

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word_a, word_b]})

    created_topic_names: list[str] = []
    created_word_terms: list[str] = []
    updated_word_ids: list[int] = []
    reassigned_word_ids: list[int] = []

    def capture_create_topic(db, payload, commit=True):
        created_topic_names.append(payload.name)
        return narrower

    def capture_create_word(db, payload, commit=True):
        created_word_terms.append(payload.term)
        return new_word

    def capture_update_word(db, w, payload, commit=True):
        if payload.topic_ids is not None:
            reassigned_word_ids.append(w.id)
        else:
            updated_word_ids.append(w.id)
        return w

    monkeypatch.setattr(ai_curation_service, "create_topic", capture_create_topic)
    monkeypatch.setattr(ai_curation_service, "create_word", capture_create_word)
    monkeypatch.setattr(ai_curation_service, "update_word", capture_update_word)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        dry_run=False,
        topic_operations=[CreateTopicOperation(client_key="retail", name="Retail Banking")],
        word_operations=[
            {"op": "update_existing_word", "id": 10, "term": "mortgage", "notes": "secured loan against property"},
            {
                "op": "create_new_word",
                "target_topic_refs": [{"client_key": "retail"}],
                "term": "collateral",
                "translations": "залог",
            },
            {
                "op": "reassign_word_topics",
                "id": 20,
                "term": "overdraft",
                "add_topic_refs": [{"client_key": "retail"}],
                "remove_topic_ids": [1],
            },
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    assert len(result.created_topics) == 1
    assert result.created_words == 1
    assert result.updated_words == 1
    assert result.reassigned_words == 1
    assert result.unchanged == 0
    assert created_topic_names == ["Retail Banking"]
    assert created_word_terms == ["collateral"]
    assert updated_word_ids == [10]
    assert reassigned_word_ids == [20]
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_import_duplicate_new_word_propagates_error_and_rolls_back(monkeypatch) -> None:
    from app.features.words.exceptions import DuplicateWordInTopicError

    source = _make_topic()
    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": []})

    call_count = [0]

    def boom_on_second(db, payload, commit=True):
        call_count[0] += 1
        if call_count[0] == 2:
            raise DuplicateWordInTopicError(payload.term)
        return _make_word(id=100 + call_count[0], term=payload.term)

    monkeypatch.setattr(ai_curation_service, "create_word", boom_on_second)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        word_operations=[
            {"op": "create_new_word", "target_topic_refs": [{"topic_id": 1}], "term": "bond", "translations": "облигация"},
            {"op": "create_new_word", "target_topic_refs": [{"topic_id": 1}], "term": "bond", "translations": "облигация"},
        ],
    )

    import pytest

    with pytest.raises(AiCurationImportError):
        ai_curation_service.import_ai_curation(db, payload)

    assert call_count[0] == 2
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_happy_path_topic_split_with_strict_mode(monkeypatch) -> None:
    source = _make_topic(id=1, name="Banking")
    retail = _make_topic(id=55, name="Retail Banking")
    investment = _make_topic(id=56, name="Investment Banking")
    word_a = _make_word(id=10, term="mortgage", topics=[source])
    word_b = _make_word(id=11, term="bond", topics=[source])

    db = MagicMock()
    db.scalar.return_value = source
    db.scalars.side_effect = lambda stmt: MagicMock(**{"all.return_value": [word_a, word_b]})

    call = [0]

    def make_topic_stub(db, payload, commit=True):
        call[0] += 1
        return retail if call[0] == 1 else investment

    final_topic_ids: dict[int, list[int]] = {}

    def capture_update(db, w, payload, commit=True):
        final_topic_ids[w.id] = payload.topic_ids
        return w

    monkeypatch.setattr(ai_curation_service, "create_topic", make_topic_stub)
    monkeypatch.setattr(ai_curation_service, "update_word", capture_update)

    payload = AiCurationImportRequest(
        source_topic_id=1,
        strict_mode=True,
        topic_operations=[
            CreateTopicOperation(client_key="retail", name="Retail Banking"),
            CreateTopicOperation(client_key="investment", name="Investment Banking"),
        ],
        word_operations=[
            {
                "op": "reassign_word_topics",
                "id": 10,
                "term": "mortgage",
                "add_topic_refs": [{"client_key": "retail"}],
                "remove_topic_ids": [1],
            },
            {
                "op": "reassign_word_topics",
                "id": 11,
                "term": "bond",
                "add_topic_refs": [{"client_key": "investment"}],
                "remove_topic_ids": [1],
            },
        ],
    )

    result = ai_curation_service.import_ai_curation(db, payload)

    assert result.reassigned_words == 2
    assert sorted(result.reassigned_word_ids) == [10, 11]
    assert result.created_words == 0
    assert result.updated_words == 0
    assert len(result.created_topics) == 2
    assert final_topic_ids[10] == [55]
    assert final_topic_ids[11] == [56]
    db.commit.assert_called_once()

