from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate
from app.features.topics.service import create_topic, InvalidTopicNameError, TopicSlugConflictError
from app.features.words.model import Word
from app.features.words.schemas import BulkImportResponse, WordBulkCreate
from app.features.words.domain import existing_normalized_terms, assert_no_duplicate_word
from app.shared.text import normalize_term


class BulkTopicInTrashError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name


class BulkSlugConflictError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail


class BulkInvalidTopicNameError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name


def bulk_import(db: Session, payload: WordBulkCreate) -> BulkImportResponse:
    topic = db.scalar(select(Topic).where(Topic.name == payload.topic_name).where(Topic.deleted_at.is_(None)))
    if topic is None:
        deleted = db.scalar(select(Topic).where(Topic.name == payload.topic_name).where(Topic.deleted_at.isnot(None)))
        if deleted is not None:
            raise BulkTopicInTrashError(payload.topic_name)
        try:
            topic = create_topic(db, TopicCreate(name=payload.topic_name))
        except InvalidTopicNameError:
            raise BulkInvalidTopicNameError(payload.topic_name)
        except TopicSlugConflictError as e:
            raise BulkSlugConflictError(e.detail)

    # Use the shared domain helper for duplicate detection — same rule as create/update
    existing = existing_normalized_terms(db, [topic.id])

    added_terms: list[str] = []
    skipped_terms: list[str] = []
    for w in payload.words:
        norm = normalize_term(w.term)
        if norm in existing:
            skipped_terms.append(w.term)
            continue
        db.add(Word(**w.model_dump(), topics=[topic]))
        existing.add(norm)
        added_terms.append(w.term)

    db.commit()
    return BulkImportResponse(
        topic_id=topic.id, topic_name=topic.name,
        added=len(added_terms), skipped=len(skipped_terms),
        added_terms=added_terms, skipped_terms=skipped_terms,
    )
