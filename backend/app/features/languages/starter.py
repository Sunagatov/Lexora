"""Validate and install reviewed starter libraries without replacing existing data."""

from __future__ import annotations

import json
import unicodedata
from collections import Counter, defaultdict
from hashlib import sha256
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.api import lock_word_identities
from app.features.words.model import PartsOfSpeech, Word, WordExample, WordTranslation
from app.shared.text import slugify

STARTER_LANGUAGES = ("zh", "es", "de", "tr", "tt", "ar", "fr", "pt")
SOURCE_PREFIX = "start1"
POS = Literal["noun", "verb", "adjective", "adverb", "phrase", "preposition", "other"]


class StarterImportError(ValueError):
    pass


class BilingualText(BaseModel):
    ru: str = Field(min_length=1)
    en: str = Field(min_length=1)
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StarterExample(BilingualText):
    text: str = Field(min_length=1)


class StarterTranslations(BaseModel):
    ru: list[str] = Field(min_length=1, max_length=20)
    en: list[str] = Field(min_length=1, max_length=20)
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StarterEntry(BaseModel):
    id: str = Field(pattern=r"^s\d{3}$")
    topic: str = Field(min_length=1, max_length=200)
    term: str = Field(min_length=1, max_length=255)
    language: Literal["zh", "es", "de", "tr", "tt", "ar", "fr", "pt"]
    part_of_speech: POS
    translations: StarterTranslations
    definitions: BilingualText
    examples: list[StarterExample] = Field(min_length=3, max_length=3)
    transliteration: str | None = None
    grammar: BilingualText | None = None
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def check_content(self):
        if not 1 <= int(self.id[1:]) <= 500:
            raise ValueError("Concept ID must be between s001 and s500")
        if not slugify(self.topic):
            raise ValueError("Topic name must contain letters or numbers")
        for target in ("ru", "en"):
            translations = getattr(self.translations, target)
            if any(not value.strip() for value in translations):
                raise ValueError(f"Blank {target} translation")
            if len({_normal(value) for value in translations}) != len(translations):
                raise ValueError(f"Repeated {target} translation")
            texts = [*translations, getattr(self.definitions, target)]
            texts.extend(getattr(example, target) for example in self.examples)
            if self.grammar:
                texts.append(getattr(self.grammar, target))
            if any(not _has_script(value, target) for value in texts):
                raise ValueError(f"Expected {target} writing in translations/explanations")
        native = [self.term, *(example.text for example in self.examples)]
        if any(not _has_script(value, self.language) for value in native):
            raise ValueError("Term and examples must use the learning language's writing system")
        if len({_normal(example.text) for example in self.examples}) != 3:
            raise ValueError("Each entry requires three distinct source examples")
        if self.language == "zh" and (
            not self.transliteration or not _has_script(self.transliteration, "en")
        ):
            raise ValueError("Mandarin entries require pinyin transliteration")
        if self.transliteration == "":
            self.transliteration = None
        return self


def _normal(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Cf")
    return " ".join(value.split()).casefold()


def _identity(value: str, language: str) -> str:
    if language == "tr":
        value = value.replace("I", "ı").replace("İ", "i")
    value = _normal(value)
    value = value.translate(str.maketrans({"’": "'", "‘": "'", "ʼ": "'"}))
    value = value.strip(" .!?؟。！？¿¡")
    if language == "ar":
        # Vocalised/unvocalised forms are one spelling, not two vocabulary entries.
        value = "".join(char for char in value if not unicodedata.combining(char) and char != "ـ")
    return value


def _has_script(value: str, language: str) -> bool:
    script = {"zh": "CJK", "ar": "ARABIC", "tt": "CYRILLIC", "ru": "CYRILLIC"}.get(
        language, "LATIN"
    )
    return any(char.isalpha() and script in unicodedata.name(char, "") for char in value)


def _digest(value: object) -> str:
    return sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def read_starter_packages(paths: list[Path]) -> list[dict]:
    entries = []
    for path in paths:
        for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise StarterImportError(f"{path.name}:{number}: invalid JSON") from exc
            if not isinstance(value, dict):
                raise StarterImportError(f"{path.name}:{number}: each row must be an object")
            entries.append(value)
    return entries


def validate_starter_entries(
    entries: list[dict], *, expected_count: int = 500, require_all_languages: bool = True
) -> list[StarterEntry]:
    """Structural checks support linguistic review; they do not certify translations."""
    parsed = []
    for number, value in enumerate(entries, 1):
        try:
            parsed.append(StarterEntry.model_validate(value))
        except ValidationError as exc:
            messages = "; ".join(
                f"{'.'.join(map(str, error['loc']))}: {error['msg']}"
                for error in exc.errors(include_input=False)
            )
            raise StarterImportError(f"Row {number}: {messages}") from exc
    languages = {entry.language for entry in parsed}
    if not parsed or (require_all_languages and languages != set(STARTER_LANGUAGES)):
        raise StarterImportError("Provide all eight new learning languages")
    if not 1 <= expected_count <= 500:
        raise StarterImportError("Expected count must be between 1 and 500")
    for language in sorted(languages):
        rows = [entry for entry in parsed if entry.language == language]
        ids = [entry.id for entry in rows]
        required_ids = {f"s{index:03}" for index in range(1, expected_count + 1)}
        if len(rows) != expected_count or set(ids) != required_ids:
            raise StarterImportError(
                f"{language}: require exactly {expected_count} unique concept IDs"
            )
        identities = [(_identity(entry.term, language), entry.part_of_speech) for entry in rows]
        if len(set(identities)) != len(identities):
            raise StarterImportError(f"{language}: duplicate word/part-of-speech identity")
    return sorted(parsed, key=lambda entry: (entry.language, entry.id))


def _source(entry: StarterEntry) -> str:
    return SOURCE_PREFIX + entry.id


def _examples(entry: StarterEntry) -> list[str]:
    return [
        f"{entry.language.upper()}: {example.text}\nRU: {example.ru}\nEN: {example.en}"
        for example in entry.examples
    ]


def _wanted_content(entry: StarterEntry) -> dict:
    return {
        "term": entry.term,
        "language": entry.language,
        "part_of_speech": entry.part_of_speech,
        "transliteration": entry.transliteration,
        "translations": entry.translations.model_dump(),
        "definitions": entry.definitions.model_dump(),
        "grammar": entry.grammar.model_dump() if entry.grammar else {"ru": None, "en": None},
        "examples": _examples(entry),
        "is_active": True,
    }


def _stored_content(word: Word) -> dict:
    groups = {"ru": [], "en": []}
    for item in word.translation_items:
        groups.setdefault(item.language or "ru", []).append(item.value)
    english = (word.explanation_groups or {}).get("en", {})
    return {
        "term": word.term,
        "language": word.language,
        "part_of_speech": word.part_of_speech.name if word.part_of_speech else None,
        "transliteration": word.transliteration,
        "translations": groups,
        "definitions": {"ru": word.definition, "en": english.get("definition")},
        "grammar": {"ru": word.notes, "en": english.get("notes")},
        "examples": [item.value for item in word.example_items],
        "is_active": word.is_active,
    }


def build_starter_plan(
    db: Session,
    entries: list[dict],
    *,
    expected_count: int = 500,
    require_all_languages: bool = True,
    lock: bool = False,
) -> dict:
    records = validate_starter_entries(
        entries, expected_count=expected_count, require_all_languages=require_all_languages
    )
    languages = sorted({entry.language for entry in records})
    query = (
        select(Word)
        .where(Word.language.in_(languages))
        .options(selectinload(Word.translation_items), selectinload(Word.example_items))
    )
    if lock:
        query = query.with_for_update(of=Word)
    words = list(db.scalars(query).all())
    by_source, by_term = defaultdict(list), defaultdict(list)
    for word in words:
        by_source[(word.language, word.source)].append(word)
        by_term[(word.language, _identity(word.term, word.language))].append(word)
    positions = {position.name for position in db.scalars(select(PartsOfSpeech)).all()}
    plan = {
        "format": "lexora-starter-plan-v1",
        "entries_sha256": _digest([entry.model_dump() for entry in records]),
        "languages": languages,
        "entries": [],
        "topics": [],
        "errors": [],
    }
    needed_topics = {}
    for entry in records:
        source = _source(entry)
        marked = by_source[(entry.language, source)]
        same_identity = [
            word
            for word in by_term[(entry.language, _identity(entry.term, entry.language))]
            if word.part_of_speech is None or word.part_of_speech.name == entry.part_of_speech
        ]
        error = None
        existing = marked[0] if len(marked) == 1 else None
        if len(marked) > 1:
            error = "Multiple existing words have this starter marker"
        elif existing is not None:
            if existing.deleted_at is not None:
                error = "Previously installed entry is in Trash; it will not be restored"
            elif _stored_content(existing) != _wanted_content(entry):
                error = "Previously installed starter content changed; it will not be overwritten"
            elif any(word.id != existing.id for word in same_identity):
                error = "Existing duplicate identity requires review"
        elif same_identity:
            error = "Word identity already exists without this starter marker; it will not be overwritten"
        if entry.part_of_speech not in positions:
            error = "Required part of speech is missing from the database"
        action = "conflict" if error else "skip" if existing else "create"
        plan["entries"].append(
            {
                "id": entry.id,
                "language": entry.language,
                "term": entry.term,
                "source": source,
                "action": action,
                "word_id": existing.id if existing else None,
            }
        )
        if error:
            plan["errors"].append(f"{entry.language}/{entry.id}: {error}")
        if action == "create":
            needed_topics.setdefault((entry.language, _normal(entry.topic)), entry.topic)
    topic_query = select(Topic).where(Topic.language.in_(languages))
    if lock:
        topic_query = topic_query.with_for_update(of=Topic)
    topics = list(db.scalars(topic_query).all())
    planned_slugs = set()
    for (language, name_key), name in sorted(needed_topics.items()):
        candidates = [
            topic
            for topic in topics
            if topic.language == language and _normal(topic.name) == name_key
        ]
        slug = slugify(name)
        topic = candidates[0] if len(candidates) == 1 else None
        error = None
        if len(candidates) > 1:
            error = "Ambiguous existing topic name"
        elif topic is not None and topic.deleted_at is not None:
            error = "Required topic is in Trash"
        elif topic is None and any(
            item.language == language and item.slug == slug for item in topics
        ):
            error = "Topic address is already used by a different topic"
        elif topic is None and (language, slug) in planned_slugs:
            error = "Two new topic names have the same address"
        planned_slugs.add((language, slug))
        if error:
            plan["errors"].append(f"{language}/{name}: {error}")
        plan["topics"].append(
            {
                "language": language,
                "name": name,
                "slug": topic.slug if topic else slug,
                "topic_id": topic.id if topic else None,
                "action": "conflict" if error else "reuse" if topic else "create",
            }
        )
    actions = Counter(entry["action"] for entry in plan["entries"])
    plan["language_summaries"] = {
        language: dict(
            Counter(entry["action"] for entry in plan["entries"] if entry["language"] == language)
        )
        for language in languages
    }
    plan["summary"] = {
        "entries": len(records),
        "create_words": actions["create"],
        "skip_words": actions["skip"],
        "conflicts": len(plan["errors"]),
        "create_topics": sum(topic["action"] == "create" for topic in plan["topics"]),
    }
    plan["plan_sha256"] = _digest(plan)
    return plan


def apply_starter_libraries(
    db: Session,
    entries: list[dict],
    expected_plan: str,
    *,
    expected_count: int = 500,
    require_all_languages: bool = True,
) -> dict:
    """Flush one reviewed batch. The caller must own and commit/rollback its transaction."""
    lock_word_identities(db)
    plan = build_starter_plan(
        db,
        entries,
        expected_count=expected_count,
        require_all_languages=require_all_languages,
        lock=True,
    )
    if plan["errors"]:
        raise StarterImportError("Starter conflicts must be resolved before applying any entries")
    if plan["plan_sha256"] != expected_plan:
        raise StarterImportError("Starter plan changed after review; run a new dry-run")
    records = validate_starter_entries(
        entries, expected_count=expected_count, require_all_languages=require_all_languages
    )
    by_id = {(entry.language, entry.id): entry for entry in records}
    positions = {position.name: position for position in db.scalars(select(PartsOfSpeech)).all()}
    topics = {}
    created_topics = []
    for item in plan["topics"]:
        topic = (
            db.get(Topic, item["topic_id"])
            if item["topic_id"]
            else Topic(
                language=item["language"], name=item["name"], slug=item["slug"], is_active=True
            )
        )
        if item["action"] == "create":
            db.add(topic)
            created_topics.append(topic)
        topics[(item["language"], _normal(item["name"]))] = topic
    db.flush()
    created = []
    for item in plan["entries"]:
        if item["action"] != "create":
            continue
        entry = by_id[(item["language"], item["id"])]
        word = Word(
            term=entry.term,
            language=entry.language,
            source=item["source"],
            part_of_speech=positions[entry.part_of_speech],
            knowledge_level=1,
            is_active=True,
            transliteration=entry.transliteration,
            definition=entry.definitions.ru,
            notes=entry.grammar.ru if entry.grammar else None,
            explanation_groups={
                "en": {
                    "definition": entry.definitions.en,
                    "notes": entry.grammar.en if entry.grammar else None,
                }
            },
            topics=[topics[(entry.language, _normal(entry.topic))]],
            translation_items=[
                WordTranslation(language=language, position=index, value=value)
                for language in ("ru", "en")
                for index, value in enumerate(getattr(entry.translations, language))
            ],
            example_items=[
                WordExample(position=index, value=value)
                for index, value in enumerate(_examples(entry))
            ],
        )
        db.add(word)
        created.append(word)
    db.flush()
    return {
        "plan_sha256": expected_plan,
        "entries_sha256": plan["entries_sha256"],
        **plan["summary"],
        "created_word_ids": [word.id for word in created],
        "created_topic_ids": [topic.id for topic in created_topics],
        "progress_preserved": True,
    }
