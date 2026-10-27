"""Starter imports use real transactions and never rewrite an existing library."""

import json
from datetime import UTC, datetime

import pytest
from app.features.languages.starter import (
    STARTER_LANGUAGES,
    StarterImportError,
    apply_starter_libraries,
    build_starter_plan,
    read_starter_packages,
    validate_starter_entries,
)
from app.features.topics.model import Topic
from app.features.words.model import PartsOfSpeech, Word, WordExample, WordTranslation
from app.features.words.progress import WordProgressEvent
from app.scripts.import_starter_libraries import main
from app.shared.db import Base
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

TERMS = {
    "zh": ["面包", "水"],
    "es": ["pan", "agua"],
    "de": ["Brot", "Wasser"],
    "tr": ["ekmek", "su"],
    "tt": ["икмәк", "су"],
    "ar": ["خبز", "ماء"],
    "fr": ["pain", "eau"],
    "pt": ["pão", "água"],
}


def rows(languages=STARTER_LANGUAGES):
    entries = []
    for language in languages:
        for index, term in enumerate(TERMS[language], 1):
            entries.append(
                {
                    "id": f"s{index:03}",
                    "topic": "Everyday food",
                    "term": term,
                    "language": language,
                    "part_of_speech": "noun",
                    "translations": {
                        "ru": ["хлеб" if index == 1 else "вода"],
                        "en": ["bread" if index == 1 else "water"],
                    },
                    "definitions": {
                        "ru": "Обычная еда или напиток.",
                        "en": "An everyday food or drink.",
                    },
                    "examples": [
                        {
                            "text": f"{term} {suffix}",
                            "ru": f"Пример номер {suffix}.",
                            "en": f"Example number {suffix}.",
                        }
                        for suffix in (1, 2, 3)
                    ],
                    **(
                        {"transliteration": "miàn bāo" if index == 1 else "shuǐ"}
                        if language == "zh"
                        else {}
                    ),
                }
            )
    return entries


def plan(db, entries, **kwargs):
    return build_starter_plan(db, entries, expected_count=2, **kwargs)


def apply(db, entries, digest, **kwargs):
    return apply_starter_libraries(db, entries, digest, expected_count=2, **kwargs)


@pytest.fixture
def database():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    event.listen(
        engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON")
    )
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as db:
        noun = PartsOfSpeech(name="noun")
        english = Topic(name="Everyday food", slug="everyday-food", language="en", is_active=True)
        existing = Word(
            term="bread",
            language="en",
            definition="Existing English definition",
            source="manual",
            part_of_speech=noun,
            knowledge_level=4,
            is_active=True,
            topics=[english],
            translation_items=[WordTranslation(language="ru", position=0, value="хлеб")],
            example_items=[WordExample(position=0, value="I bought bread.")],
        )
        db.add(existing)
        db.flush()
        db.add(WordProgressEvent(word_id=existing.id, old_level=1, new_level=4, source="manual"))
        db.commit()
        yield db, existing.id
    engine.dispose()


def english_state(db, english_id):
    word = db.get(Word, english_id)
    return {
        "columns": {column.name: getattr(word, column.name) for column in Word.__table__.columns},
        "topics": [(topic.id, topic.name, topic.slug, topic.language) for topic in word.topics],
        "translations": [
            (item.id, item.language, item.position, item.value) for item in word.translation_items
        ],
        "examples": [(item.id, item.position, item.value) for item in word.example_items],
        "progress": [
            (item.id, item.old_level, item.new_level, item.source) for item in word.progress_events
        ],
    }


def test_all_libraries_are_atomic_bilingual_and_leave_english_unchanged(database):
    db, english_id = database
    before = english_state(db, english_id)
    entries = rows()
    preview = plan(db, entries)
    assert preview["errors"] == []
    assert preview["summary"] == {
        "entries": 16,
        "create_words": 16,
        "skip_words": 0,
        "conflicts": 0,
        "create_topics": 8,
    }
    assert not db.new and not db.dirty
    assert db.scalar(select(func.count()).select_from(Word)) == 1
    result = apply(db, entries, preview["plan_sha256"])
    db.commit()
    assert len(result["created_word_ids"]) == 16 and len(result["created_topic_ids"]) == 8
    assert english_state(db, english_id) == before
    for word in db.scalars(select(Word).where(Word.language != "en")).all():
        assert word.knowledge_level == 1
        assert len(word.source) == 10 and word.source.startswith("start1s")
        assert {item.language for item in word.translation_items} == {"ru", "en"}
        assert len(word.example_items) == 3
        assert all(
            f"{word.language.upper()}:" in item.value
            and "RU:" in item.value
            and "EN:" in item.value
            for item in word.example_items
        )
        assert word.explanation_groups["en"]["definition"]
        assert all(topic.language == word.language for topic in word.topics)
    assert db.scalar(select(func.count()).select_from(WordProgressEvent)) == 1


def test_repeat_run_preserves_new_ratings_history_and_user_topic_changes(database):
    db, _ = database
    entries = rows()
    first = plan(db, entries)
    apply(db, entries, first["plan_sha256"])
    db.commit()
    existing_ids = list(db.scalars(select(Word.id).order_by(Word.id)).all())
    initial_repeat = plan(db, entries)
    word = db.scalar(select(Word).where(Word.language == "es", Word.source == "start1s001"))
    word.knowledge_level = 4
    user_topic = Topic(language="es", name="My selected topic", slug="my-topic", is_active=True)
    word.topics = [user_topic]
    db.add(WordProgressEvent(word_id=word.id, old_level=1, new_level=4, source="manual"))
    db.commit()
    second = plan(db, entries)
    assert second["summary"]["skip_words"] == 16 and second["summary"]["create_topics"] == 0
    assert second["plan_sha256"] == initial_repeat["plan_sha256"]
    result = apply(db, entries, second["plan_sha256"])
    db.commit()
    assert result["created_word_ids"] == []
    assert list(db.scalars(select(Word.id).order_by(Word.id)).all()) == existing_ids
    assert word.knowledge_level == 4 and word.topics == [user_topic]
    assert db.scalar(select(func.count()).select_from(WordProgressEvent)) == 2


def test_edited_seed_content_aborts_new_libraries_without_overwrite(database):
    db, _ = database
    entries = rows(["es"])
    first = plan(db, entries, require_all_languages=False)
    apply(db, entries, first["plan_sha256"], require_all_languages=False)
    db.commit()
    word = db.scalar(select(Word).where(Word.language == "es", Word.source == "start1s001"))
    word.definition = "Моя новая формулировка."
    db.commit()
    expanded = rows(["es", "de"])
    blocked = plan(db, expanded, require_all_languages=False)
    assert any("content changed" in error for error in blocked["errors"])
    with pytest.raises(StarterImportError, match="conflicts"):
        apply(db, expanded, blocked["plan_sha256"], require_all_languages=False)
    db.rollback()
    assert db.scalar(select(func.count()).select_from(Word).where(Word.language == "de")) == 0
    assert db.get(Word, word.id).definition == "Моя новая формулировка."


def test_existing_manual_identity_and_trashed_topics_are_conflicts(database):
    db, _ = database
    noun = db.scalar(select(PartsOfSpeech).where(PartsOfSpeech.name == "noun"))
    db.add(
        Word(
            term="PAN",
            language="es",
            part_of_speech=noun,
            knowledge_level=3,
            is_active=True,
            source="manual",
        )
    )
    db.commit()
    preview = plan(db, rows())
    assert any("without this starter marker" in error for error in preview["errors"])
    assert preview["summary"]["skip_words"] == 0
    assert not db.new


def test_trashed_seed_and_topic_are_not_implicitly_restored(database):
    db, _ = database
    entries = rows(["es"])
    topic = Topic(
        language="es",
        name="Everyday food",
        slug="everyday-food",
        is_active=True,
        deleted_at=datetime.now(UTC),
    )
    db.add(topic)
    db.commit()
    blocked = plan(db, entries, require_all_languages=False)
    assert any("topic is in Trash" in error for error in blocked["errors"])
    db.delete(topic)
    db.commit()
    preview = plan(db, entries, require_all_languages=False)
    apply(db, entries, preview["plan_sha256"], require_all_languages=False)
    db.commit()
    seed = db.scalar(select(Word).where(Word.language == "es", Word.source == "start1s001"))
    seed.deleted_at = datetime.now(UTC)
    db.commit()
    blocked = plan(db, entries, require_all_languages=False)
    assert any("entry is in Trash" in error for error in blocked["errors"])
    assert seed.deleted_at is not None


def test_stale_review_and_transaction_rollback_do_not_leave_partial_imports(database):
    db, _ = database
    entries = rows()
    original = plan(db, entries)
    db.add(Topic(language="es", name="Everyday food", slug="everyday-food", is_active=True))
    db.commit()
    with pytest.raises(StarterImportError, match="changed after review"):
        apply(db, entries, original["plan_sha256"])
    assert db.scalar(select(func.count()).select_from(Word)) == 1
    fresh = plan(db, entries)
    apply(db, entries, fresh["plan_sha256"])
    db.rollback()  # Simulates any later operator verification failure before commit.
    assert db.scalar(select(func.count()).select_from(Word)) == 1
    assert db.scalar(select(func.count()).select_from(Topic)) == 2


def test_rating_change_in_english_does_not_invalidate_or_overwrite_plan(database):
    db, english_id = database
    entries = rows()
    preview = plan(db, entries)
    db.get(Word, english_id).knowledge_level = 5
    db.commit()
    apply(db, entries, preview["plan_sha256"])
    db.commit()
    assert db.get(Word, english_id).knowledge_level == 5


@pytest.mark.parametrize(
    "mutation,message",
    [
        (lambda data: data.pop(), "exactly"),
        (lambda data: data[0].update(id="s500"), "exactly"),
        (lambda data: data[0].update(language="en"), "language"),
        (lambda data: data[0].update(knowledge_level=4), "Extra inputs"),
        (lambda data: data[0].update(term="BREAD"), "writing system"),
        (lambda data: data[0].pop("transliteration"), "pinyin"),
        (lambda data: data[0]["examples"].__setitem__(1, data[0]["examples"][0]), "distinct"),
        (lambda data: data[0]["translations"].update(ru=["bread"]), "Expected ru"),
        (lambda data: data[0]["translations"].update(ru=["хлеб", "ХЛЕБ"]), "Repeated"),
    ],
)
def test_structural_problems_are_rejected_before_database_work(mutation, message):
    entries = rows(["zh"])
    mutation(entries)
    with pytest.raises(StarterImportError, match=message):
        validate_starter_entries(entries, expected_count=2, require_all_languages=False)


def test_arabic_diacritics_do_not_create_duplicate_vocabulary():
    entries = rows(["ar"])
    entries[0]["term"], entries[1]["term"] = "خُبْز", "خبز"
    with pytest.raises(StarterImportError, match="duplicate"):
        validate_starter_entries(entries, expected_count=2, require_all_languages=False)


@pytest.mark.parametrize(
    "language,first,second",
    [
        ("tr", "İyi günler", "iyi günler!"),
        ("fr", "s'il vous plaît", "s’il vous plaît"),
        ("es", "¿Cómo estás?", "Cómo estás"),
    ],
)
def test_case_and_punctuation_variants_do_not_create_duplicates(language, first, second):
    entries = rows([language])
    entries[0]["term"], entries[1]["term"] = first, second
    with pytest.raises(StarterImportError, match="duplicate"):
        validate_starter_entries(entries, expected_count=2, require_all_languages=False)


def test_500_per_language_is_the_default_and_all_languages_are_required():
    with pytest.raises(StarterImportError, match="eight"):
        validate_starter_entries(rows(["es"]), expected_count=2)
    with pytest.raises(StarterImportError, match="500"):
        validate_starter_entries(rows())


def test_jsonl_reader_and_cli_do_not_overwrite_inputs_or_accept_sqlite(database, tmp_path, capsys):
    file = tmp_path / "es.jsonl"
    file.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows(["es"])), encoding="utf-8"
    )
    assert len(read_starter_packages([file])) == 2
    with pytest.raises(SystemExit):
        main([str(file), "--report", str(file)])
    with pytest.raises(SystemExit):
        main([str(file), "--report", str(tmp_path / "report.json"), "--apply"])
    assert main([str(file), "--report", str(tmp_path / "report.json")]) == 1
    assert "PostgreSQL is required" in capsys.readouterr().err
    assert not (tmp_path / "report.json").exists()
