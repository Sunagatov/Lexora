import json
import subprocess
import sys
from datetime import UTC
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.features.offline.service import comparable, snapshot
from app.features.topics.model import Topic
from app.features.words.model import PartsOfSpeech, Word, WordTranslation
from app.features.words.pronunciation_import import (
    PronunciationEntry,
    PronunciationImportError,
    apply_plan,
    build_plan,
    read_package,
)
from app.features.words.repository import update_word
from app.features.words.schemas import WordResponse, WordUpdate
from app.shared.db import Base

PACKAGE = Path(__file__).resolve().parents[2] / "data/pronunciation/es-20261028"


def test_operator_import_initializes_models_in_a_fresh_process():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.features.words.pronunciation_import import build_plan; from sqlalchemy.orm import configure_mappers; configure_mappers()",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def entry(**overrides):
    return PronunciationEntry.model_validate(
        {
            "word_id": 1,
            "language": "es",
            "term": "hola",
            "part_of_speech": "phrase",
            "pronunciation_easy": "о́ла",
            "pronunciation_note_ru": None,
            "status": "ready",
            "issue": None,
            **overrides,
        }
    )


@pytest.fixture
def database():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as db:
        word = Word(
            id=1,
            term="hola",
            language="es",
            knowledge_level=4,
            part_of_speech=PartsOfSpeech(name="phrase"),
            pronunciation_ipa="ˈola",
            pronunciation_audio_url="https://example.org/hola.mp3",
            topics=[Topic(name="Greetings", slug="greetings", language="es")],
            translation_items=[WordTranslation(value="привет", position=0, language="ru")],
        )
        db.add(word)
        db.commit()
        db.info["language"] = "es"
        yield db, word
    engine.dispose()


def test_reviewed_package_is_complete_and_checksums_match():
    rows, manifest = read_package(
        PACKAGE / "lexora-es-cyrillic-pronunciation.jsonl",
        PACKAGE / "lexora-es-cyrillic-manifest.json",
    )
    assert len(rows) == 500
    assert {r.word_id for r in rows} == set(range(18861, 19361))
    assert next(r for r in rows if r.word_id == 19130).pronunciation_easy == "ла полиси́а"
    assert manifest["review"]["approved_for_import"] is False


def test_rejects_changed_bytes_and_duplicate_ids(tmp_path):
    manifest = json.loads(
        (PACKAGE / "lexora-es-cyrillic-manifest.json").read_text(encoding="utf-8")
    )
    raw = (entry().model_dump_json() + "\n") * 2
    data, meta = tmp_path / "data.jsonl", tmp_path / "manifest.json"
    data.write_text(raw, encoding="utf-8")
    meta.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(PronunciationImportError, match="checksum"):
        read_package(data, meta)
    import hashlib

    manifest["output"]["sha256"] = hashlib.sha256(data.read_bytes()).hexdigest()
    manifest["languages"]["es"]["unique_output_word_ids"] = 2
    meta.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(PronunciationImportError, match="Duplicate"):
        read_package(data, meta)


def test_only_hints_change_and_repeat_import_is_noop(database):
    db, word = database
    original = {
        c.name: getattr(word, c.name)
        for c in Word.__table__.columns
        if not c.name.startswith("pronunciation_easy") and c.name != "pronunciation_note_ru"
    }
    plan = build_plan(db, [entry()])
    assert plan["summary"] == {"update": 1, "unchanged": 0, "conflicts": 0}
    apply_plan(db, [entry()], plan["plan_sha256"])
    db.commit()
    assert original == {name: getattr(word, name) for name in original}
    assert word.translation_items[0].value == "привет"
    assert len(word.topics) == 1
    assert not word.progress_events
    assert WordResponse.from_word(word).pronunciation_easy == "о́ла"
    assert snapshot(db)["words"][0]["pronunciation_easy"] == "о́ла"
    repeated = build_plan(db, [entry()])
    assert repeated["summary"] == {"update": 0, "unchanged": 1, "conflicts": 0}
    assert apply_plan(db, [entry()], repeated["plan_sha256"])["changes"] == []


@pytest.mark.parametrize(
    "overrides",
    [{"term": "adiós"}, {"language": "en"}, {"part_of_speech": "noun"}, {"deleted_at": "deleted"}],
)
def test_identity_changes_block_entire_import(database, overrides):
    db, word = database
    expected = build_plan(db, [entry()])["plan_sha256"]
    for key, value in overrides.items():
        if key == "deleted_at":
            from datetime import datetime

            value = datetime.now(UTC)
        if key == "part_of_speech":
            word.part_of_speech = PartsOfSpeech(name=value)
        else:
            setattr(word, key, value)
    db.flush()
    with pytest.raises(PronunciationImportError):
        apply_plan(db, [entry()], expected)
    assert word.pronunciation_easy is None


def test_concurrent_hint_edit_is_not_overwritten(database):
    db, word = database
    expected = build_plan(db, [entry()])["plan_sha256"]
    word.pronunciation_easy = "another reading"
    db.flush()
    with pytest.raises(PronunciationImportError):
        apply_plan(db, [entry()], expected)
    assert word.pronunciation_easy == "another reading"


def test_old_offline_copy_remains_comparable_after_import():
    before = {"term": "hola", "topic_ids": [1], "knowledge_level": 4}
    assert comparable(before) == comparable(
        {**before, "pronunciation_easy": "о́ла", "pronunciation_note_ru": "hint"}
    )


def test_editing_word_clears_stale_hints_but_rating_edit_keeps_them(database):
    db, word = database
    word.pronunciation_easy = "о́ла"
    word.pronunciation_note_ru = "hint"
    db.commit()
    update_word(db, word, WordUpdate(knowledge_level=3))
    assert word.pronunciation_easy == "о́ла"
    update_word(db, word, WordUpdate(term="adiós"))
    assert word.pronunciation_easy is None
    assert word.pronunciation_note_ru is None
    assert db.scalar(select(Word.knowledge_level).where(Word.id == 1)) == 3
