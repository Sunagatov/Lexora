from typing import Annotated

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.features.offline.service import topic_data, word_data
from app.features.topics.model import Topic
from app.features.words.api import with_word_details
from app.features.words.model import Word
from app.shared.config import settings

MAX_CHANGED_ROWS = 4_000
CatalogId = Annotated[int, Field(strict=True, ge=1, le=2_147_483_647)]


class CatalogCursor(BaseModel):
    version: int = Field(strict=True, ge=1, le=1)
    epoch: str = Field(pattern=r"^[a-f0-9]{32}$")
    revision: str = Field(pattern=r"^(?:0|[1-9][0-9]{0,18})$")

    model_config = ConfigDict(extra="forbid", strict=True)


class CatalogChangeRequest(BaseModel):
    cursor: CatalogCursor
    force_word_ids: list[CatalogId] = Field(default_factory=list, max_length=MAX_CHANGED_ROWS)
    force_topic_ids: list[CatalogId] = Field(default_factory=list, max_length=MAX_CHANGED_ROWS)

    model_config = ConfigDict(extra="forbid", strict=True)


def read_catalog_cursor(db: Session) -> CatalogCursor | None:
    if db.get_bind().dialect.name != "postgresql":
        return None
    installed = db.scalar(text("""
        SELECT to_regclass('offline_catalog_epoch') IS NOT NULL
           AND to_regclass('offline_catalog_changes') IS NOT NULL
    """))
    if not installed:
        return None
    row = db.execute(text("""
        SELECT epoch, coalesce((SELECT max(revision) FROM offline_catalog_changes), 0) AS revision
        FROM offline_catalog_epoch WHERE singleton
    """)).one_or_none()
    if row is None:
        return None
    return CatalogCursor(version=1, epoch=row.epoch, revision=str(row.revision))


def _reseed() -> HTTPException:
    return HTTPException(409, {
        "code": "offline_cursor_reseed",
        "message": "Refresh the saved library before syncing again.",
    })


def catalog_changes(db: Session, payload: CatalogChangeRequest) -> dict:
    """Read changes in the repeatable-read transaction opened by the caller."""
    current = read_catalog_cursor(db)
    if not current or current.epoch != payload.cursor.epoch or int(payload.cursor.revision) > int(current.revision):
        raise _reseed()

    changed = db.execute(text("""
        SELECT DISTINCT kind, entity_id
        FROM offline_catalog_changes
        WHERE revision > :known_revision AND revision <= :current_revision
        LIMIT :scan_limit
    """), {
        "known_revision": int(payload.cursor.revision),
        "current_revision": int(current.revision),
        "scan_limit": MAX_CHANGED_ROWS + 1,
    }).all()

    word_ids = set(payload.force_word_ids)
    topic_ids = set(payload.force_topic_ids)
    for kind, entity_id in changed:
        (word_ids if kind == "word" else topic_ids).add(entity_id)
    if len(word_ids) + len(topic_ids) > MAX_CHANGED_ROWS:
        raise _reseed()

    words = (
        db.scalars(with_word_details(select(Word).where(Word.id.in_(word_ids)).order_by(Word.id))).all()
        if word_ids else []
    )
    topics = db.scalars(select(Topic).where(Topic.id.in_(topic_ids)).order_by(Topic.id)).all() if topic_ids else []
    return {
        "version": 1,
        "cursor": current.model_dump(),
        "words": [word_data(word) for word in words],
        "topics": [topic_data(topic) for topic in topics],
        "removed_word_ids": sorted(word_ids - {word.id for word in words}),
        "removed_topic_ids": sorted(topic_ids - {topic.id for topic in topics}),
        "public_config": {"trash_retention_days": settings.trash_retention_days},
    }
