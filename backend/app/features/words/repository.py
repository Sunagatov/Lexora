import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.topics.model import Topic
from app.features.words.model import Word, WordExample, WordTranslation, word_topics
from app.features.words.schemas import WordCreate, WordUpdate
from app.features.words.domain import existing_normalized_terms, assert_no_duplicate_word
from app.features.stats.service import record_level_change


def _with_details(stmt):
    return stmt.options(
        selectinload(Word.topics),
        selectinload(Word.translation_items),
        selectinload(Word.example_items),
    )


def _clean_entries(values: list[str] | None) -> list[str]:
    if not values:
        return []

    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        value = raw.strip()
        if not value:
            continue
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _split_translation_text(value: str | None) -> list[str]:
    if value is None:
        return []
    text = value.strip()
    if not text:
        return []
    return _clean_entries(re.split(r"(?:\r?\n|;)+", text))


def _split_example_text(value: str | None) -> list[str]:
    if value is None:
        return []
    text = value.strip()
    if not text:
        return []
    return _clean_entries(text.replace("\r\n", "\n").replace("\r", "\n").split("\n"))


def _resolve_translation_entries(raw_text: str | None, explicit_entries: list[str] | None) -> list[str]:
    if explicit_entries is not None:
        cleaned = _clean_entries(explicit_entries)
        if cleaned:
            return cleaned
    return _split_translation_text(raw_text)


def _resolve_example_entries(raw_text: str | None, explicit_entries: list[str] | None) -> list[str]:
    if explicit_entries is not None:
        cleaned = _clean_entries(explicit_entries)
        if cleaned:
            return cleaned
        if raw_text is None or not raw_text.strip():
            return []
    return _split_example_text(raw_text)


def _build_translation_summary(entries: list[str], fallback_raw_text: str | None) -> str:
    if entries:
        return "; ".join(entries)
    return (fallback_raw_text or "").strip()


def _build_example_summary(entries: list[str], fallback_raw_text: str | None) -> str | None:
    if entries:
        return "\n".join(entries)
    raw = (fallback_raw_text or "").strip()
    return raw or None


def sync_word_multivalue_fields(
    word: Word,
    translations_text: str | None,
    translation_entries: list[str] | None,
    example_text: str | None,
    example_entries: list[str] | None,
) -> None:
    resolved_translations = _resolve_translation_entries(translations_text, translation_entries)
    resolved_examples = _resolve_example_entries(example_text, example_entries)

    word.translations = _build_translation_summary(resolved_translations, translations_text)
    word.example = _build_example_summary(resolved_examples, example_text)

    word.translation_items = [
        WordTranslation(position=index, value=value)
        for index, value in enumerate(resolved_translations)
    ]
    word.example_items = [
        WordExample(position=index, value=value)
        for index, value in enumerate(resolved_examples)
    ]


def get_all_words(db: Session, topic_id: int | None = None, search: str | None = None) -> list[Word]:
    stmt = _with_details(select(Word).where(Word.deleted_at.is_(None)).order_by(Word.term.asc()))
    if topic_id is not None:
        stmt = (
            stmt.join(word_topics, word_topics.c.word_id == Word.id)
            .join(Topic, Topic.id == word_topics.c.topic_id)
            .where(Topic.id == topic_id)
            .where(Topic.deleted_at.is_(None))
        )
    if search:
        needle = f"%{search}%"
        stmt = stmt.where(
            Word.term.ilike(needle)
            | Word.translations.ilike(needle)
            | Word.pattern.ilike(needle)
            | Word.example.ilike(needle)
            | Word.notes.ilike(needle)
            | Word.past_simple.ilike(needle)
            | Word.past_participle.ilike(needle)
        )
    return list(db.scalars(stmt).all())


def get_word_by_id(db: Session, word_id: int) -> Word | None:
    return db.scalar(_with_details(select(Word).where(Word.id == word_id).where(Word.deleted_at.is_(None))))


def get_word_by_id_including_deleted(db: Session, word_id: int) -> Word | None:
    return db.scalar(_with_details(select(Word).where(Word.id == word_id)))


def get_deleted_words(db: Session) -> list[Word]:
    return list(db.scalars(
        _with_details(select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc()))
    ).all())


def create_word(db: Session, payload: WordCreate, *, commit: bool = True) -> Word:
    assert_no_duplicate_word(payload.term, existing_normalized_terms(db, payload.topic_ids))
    topics: list[Topic] = list(db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all())
    data = payload.model_dump(
        exclude={"topic_ids", "translation_entries", "example_entries"}
    )
    word = Word(**data, topics=list(topics))
    sync_word_multivalue_fields(
        word,
        payload.translations,
        payload.translation_entries,
        payload.example,
        payload.example_entries,
    )
    db.add(word)
    if commit:
        db.commit()
        db.refresh(word)
    else:
        db.flush()
    return word


def update_word(db: Session, word: Word, payload: WordUpdate, *, commit: bool = True) -> Word:
    fields_set = payload.model_fields_set
    data = payload.model_dump(
        exclude_unset=True,
        exclude={
            "topic_ids",
            "progress_source",
            "translations",
            "translation_entries",
            "example",
            "example_entries",
        },
    )
    effective_term = data.get("term", word.term)
    target_topic_ids = payload.topic_ids if payload.topic_ids is not None else [int(topic.id) for topic in word.topics]
    term_changed   = "term" in data and effective_term != word.term
    topics_changed = payload.topic_ids is not None and set(payload.topic_ids) != {int(topic.id) for topic in word.topics}
    if term_changed or topics_changed:
        assert_no_duplicate_word(
            effective_term,
            existing_normalized_terms(db, target_topic_ids, exclude_word_id=word.id),
        )

    old_level = word.knowledge_level
    for field, value in data.items():
        setattr(word, field, value)
    if payload.topic_ids is not None:
        topics: list[Topic] = list(db.scalars(select(Topic).where(Topic.id.in_(payload.topic_ids))).all())
        word.topics = topics

    translation_requested = "translations" in fields_set or "translation_entries" in fields_set
    example_requested = "example" in fields_set or "example_entries" in fields_set
    if translation_requested or example_requested:
        current_translations_text = word.translations
        current_example_text = word.example
        current_translation_entries = [
            item.value for item in getattr(word, "translation_items", [])
        ]
        current_example_entries = [
            item.value for item in getattr(word, "example_items", [])
        ]

        # Clear before re-assigning to avoid unique constraint violations on flush
        # (SQLAlchemy may INSERT new rows before DELETE-ing old ones)
        word.translation_items = []
        word.example_items = []
        db.flush()

        translations_text: str | None = (
            payload.translations if "translations" in fields_set else current_translations_text
        )
        if "translation_entries" in fields_set:
            translation_entries: list[str] | None = payload.translation_entries
        elif "translations" in fields_set:
            translation_entries = None
        else:
            translation_entries = current_translation_entries

        example_text: str | None = (
            payload.example if "example" in fields_set else current_example_text
        )
        if "example_entries" in fields_set:
            example_entries: list[str] | None = payload.example_entries
        elif "example" in fields_set:
            example_entries = None
        else:
            example_entries = current_example_entries

        sync_word_multivalue_fields(
            word,
            translations_text,
            translation_entries,
            example_text,
            example_entries,
        )

    if "knowledge_level" in data and data["knowledge_level"] != old_level and data["knowledge_level"] is not None:
        source = payload.progress_source or "manual"
        record_level_change(db, int(word.id), old_level, int(data["knowledge_level"]), source)
    db.add(word)
    if commit:
        db.commit()
        db.refresh(word)
    else:
        db.flush()
    return word


def soft_delete_word(db: Session, word: Word) -> Word:
    word.deleted_at = datetime.now(timezone.utc)
    word.deleted_via_topic_id = None
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def restore_word(db: Session, word: Word) -> Word:
    word.deleted_at = None
    word.deleted_via_topic_id = None
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def hard_delete_word(db: Session, word: Word) -> None:
    db.delete(word)
    db.commit()
