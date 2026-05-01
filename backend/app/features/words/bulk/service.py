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
from app.features.topics.repository import (
    find_active_topic_by_exact_name,
    find_active_topic_by_slug,
    find_deleted_topic_by_exact_name,
    find_deleted_topic_by_slug,
)
from app.features.topics.service import create_topic_draft
from app.features.words.model import Word
from app.features.words.domain import existing_normalized_terms
from app.features.words.repository import sync_word_multivalue_fields
from app.features.words.schemas import BulkImportResponse, WordBulkCreate
from app.shared.text import normalize_term, slugify


def bulk_import(db: Session, payload: WordBulkCreate) -> BulkImportResponse:
    topic_slug = slugify(payload.topic_name, max_len=TOPIC_SLUG_MAX_LEN)
    if not topic_slug:
        raise BulkInvalidTopicNameError(payload.topic_name)

    try:
        topic = find_active_topic_by_exact_name(db, payload.topic_name)
        if topic is None:
            topic = find_active_topic_by_slug(db, topic_slug)

        if topic is None:
            deleted = find_deleted_topic_by_exact_name(db, payload.topic_name)
            if deleted is None:
                deleted = find_deleted_topic_by_slug(db, topic_slug)
            if deleted is not None:
                raise BulkTopicInTrashError(str(deleted.name))
            try:
                topic = create_topic_draft(db, name=payload.topic_name)
            except InvalidTopicNameError:
                raise BulkInvalidTopicNameError(payload.topic_name)
            except (TopicSlugConflictError, TopicNameConflictError) as e:
                raise BulkSlugConflictError(e.detail)

        topic_id = cast(int, cast(object, topic.id))
        topic_name = cast(str, cast(object, topic.name))

        # Use the shared domain helper for duplicate detection — same rule as create/update
        existing = existing_normalized_terms(db, [topic_id])

        added_terms: list[str] = []
        skipped_terms: list[str] = []
        for w in payload.words:
            norm = normalize_term(w.term)
            if norm in existing:
                skipped_terms.append(w.term)
                continue
            word = Word(
                **w.model_dump(exclude={"translation_entries", "example_entries"}),
                topics=[topic],
            )
            sync_word_multivalue_fields(
                word,
                w.translations,
                w.translation_entries,
                w.example,
                w.example_entries,
            )
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
