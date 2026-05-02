from __future__ import annotations

from typing import cast

from sqlalchemy.orm import Session

from app.features.words.bulk.exceptions import (
    BulkInvalidTopicNameError,
    BulkSlugConflictError,
    BulkTopicInTrashError,
)
from app.features.topics.constants import TOPIC_SLUG_MAX_LEN
from app.features.topics.exceptions import InvalidTopicNameError, TopicNameConflictError, TopicSlugConflictError
from app.features.topics.api import (
    find_active_topic_by_exact_name,
    find_active_topic_by_slug,
    create_topic_draft,
    find_deleted_topic_by_exact_name,
    find_deleted_topic_by_slug,
)
from app.features.words.model import Word, WordVerbForm
from app.features.words.api import existing_normalized_terms
from app.features.words.multivalue import sync_word_multivalue_fields
from app.features.words.repository import _resolve_pos_id
from app.features.words.schemas import BulkImportResponse, WordBulkCreate
from app.shared.text import normalize_term, slugify


def _resolve_topic_for_bulk_import(db: Session, topic_name: str):
    topic_slug = slugify(topic_name, max_len=TOPIC_SLUG_MAX_LEN)
    if not topic_slug:
        raise BulkInvalidTopicNameError(topic_name)

    topic = find_active_topic_by_exact_name(db, topic_name)
    if topic is None:
        topic = find_active_topic_by_slug(db, topic_slug)
    if topic is not None:
        return topic

    deleted = find_deleted_topic_by_exact_name(db, topic_name)
    if deleted is None:
        deleted = find_deleted_topic_by_slug(db, topic_slug)
    if deleted is not None:
        raise BulkTopicInTrashError(str(deleted.name))

    try:
        return create_topic_draft(db, name=topic_name)
    except InvalidTopicNameError:
        raise BulkInvalidTopicNameError(topic_name)
    except (TopicSlugConflictError, TopicNameConflictError) as e:
        raise BulkSlugConflictError(e.detail)


def _build_bulk_word(db: Session, topic, payload_word) -> Word:
    pos_id = _resolve_pos_id(db, payload_word.part_of_speech) if payload_word.part_of_speech else None
    word = Word(
        term=payload_word.term,
        language=getattr(payload_word, "language", "en"),
        definition=getattr(payload_word, "definition", None),
        pronunciation_ipa=getattr(payload_word, "pronunciation_ipa", None),
        part_of_speech_id=pos_id,
        cefr_level=payload_word.cefr_level,
        register=payload_word.register,
        countability=payload_word.countability,
        frequency_rank=payload_word.frequency_rank,
        knowledge_level=payload_word.knowledge_level,
        pattern=payload_word.pattern,
        notes=payload_word.notes,
        is_active=True,
        topics=[topic],
    )
    if payload_word.verb_form:
        vf = payload_word.verb_form
        word.verb_form = WordVerbForm(
            past_simple=vf.past_simple,
            past_participle=vf.past_participle,
            present_participle=vf.present_participle,
            third_person=vf.third_person,
        )
    sync_word_multivalue_fields(
        word,
        None,
        payload_word.translation_entries,
        None,
        payload_word.example_entries,
    )
    return word


def bulk_import(db: Session, payload: WordBulkCreate) -> BulkImportResponse:
    try:
        topic = _resolve_topic_for_bulk_import(db, payload.topic_name)
        topic_id = cast(int, cast(object, topic.id))
        topic_name = cast(str, cast(object, topic.name))
        existing = existing_normalized_terms(db, [topic_id])

        added_terms: list[str] = []
        skipped_terms: list[str] = []
        for w in payload.words:
            norm = normalize_term(w.term)
            if norm in existing:
                skipped_terms.append(w.term)
                continue
            word = _build_bulk_word(db, topic, w)
            db.add(word)
            existing.add(norm)
            added_terms.append(w.term)

        db.commit()
        return BulkImportResponse(
            topic_id=topic_id,
            topic_name=topic_name,
            added=len(added_terms),
            skipped=len(skipped_terms),
            added_terms=added_terms,
            skipped_terms=skipped_terms,
        )
    except Exception:
        db.rollback()
        raise
