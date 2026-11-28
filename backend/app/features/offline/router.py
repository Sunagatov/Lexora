from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.offline.cursor import CatalogChangeRequest, catalog_changes, read_catalog_cursor
from app.features.offline.service import (
    OfflineChange,
    OfflineRevisions,
    apply_change,
    delta,
    snapshot,
)
from app.features.topics.exceptions import (
    InvalidTopicNameError,
    InvalidTopicParentError,
    MissingTopicsError,
    TopicHasActiveChildrenError,
    TopicNameConflictError,
    TopicSlugConflictError,
)
from app.features.words.exceptions import DuplicateWordInTopicError
from app.shared.deps import get_db

router = APIRouter(prefix="/api/offline", tags=["offline"])


class OfflineChangeBatch(BaseModel):
    changes: list[OfflineChange] = Field(min_length=1, max_length=24)

    @field_validator("changes")
    @classmethod
    def independent_updates(cls, changes: list[OfflineChange]) -> list[OfflineChange]:
        if any(change.entity != "word" or change.action != "update" or change.entity_id <= 0 for change in changes):
            raise ValueError("Only updates to existing words can be batched")
        if len({change.entity_id for change in changes}) != len(changes):
            raise ValueError("A batch can only contain one edit per word")
        if len({change.id for change in changes}) != len(changes):
            raise ValueError("A batch cannot reuse an operation ID")
        return changes


def _begin_consistent_read(db: Session) -> None:
    # Snapshot rows and their select-in relationships must see the same commit.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"))


@router.get("/snapshot")
def get_snapshot(
    db: Annotated[Session, Depends(get_db)],
    all_languages: Annotated[bool, Header(alias="X-Lexora-All-Languages")] = False,
    include_revisions: bool = False,
    include_cursor: bool = False,
):
    if include_revisions or include_cursor:
        _begin_consistent_read(db)
    cursor = read_catalog_cursor(db) if include_cursor and all_languages else None
    result = snapshot(db, all_languages=all_languages, include_revisions=include_revisions and cursor is None)
    if cursor is not None:
        result["cursor"] = cursor.model_dump()
    return result


@router.post("/delta")
def get_delta(
    revisions: OfflineRevisions,
    db: Annotated[Session, Depends(get_db)],
    all_languages: Annotated[bool, Header(alias="X-Lexora-All-Languages")] = False,
    include_cursor: bool = False,
):
    _begin_consistent_read(db)
    cursor = read_catalog_cursor(db) if include_cursor and all_languages else None
    result = delta(db, revisions, all_languages=all_languages)
    if cursor is not None:
        result["cursor"] = cursor.model_dump()
    return result


@router.post("/cursor")
def get_cursor_changes(payload: CatalogChangeRequest, db: Annotated[Session, Depends(get_db)]):
    _begin_consistent_read(db)
    return catalog_changes(db, payload)


@router.post("/changes")
def sync_change(
    change: OfflineChange,
    db: Annotated[Session, Depends(get_db)],
    conflict_details: Annotated[bool, Header(alias="X-Lexora-Conflict-Details")] = False,
):
    try:
        return apply_change(db, change, include_conflict_details=conflict_details)
    except HTTPException:
        db.rollback()
        raise
    except ValidationError:
        db.rollback()
        raise HTTPException(
            422, "Offline edit contains invalid fields; local changes are preserved"
        )
    except (
        InvalidTopicNameError,
        InvalidTopicParentError,
        MissingTopicsError,
        TopicHasActiveChildrenError,
        TopicNameConflictError,
        TopicSlugConflictError,
        DuplicateWordInTopicError,
    ) as error:
        db.rollback()
        raise HTTPException(409, getattr(error, "detail", None) or str(error))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "This edit conflicts with existing content. Local changes are preserved."
        )


@router.post("/changes/batch")
def sync_change_batch(payload: OfflineChangeBatch, db: Annotated[Session, Depends(get_db)]):
    results = []
    for change in payload.changes:
        try:
            result = sync_change(change, db, conflict_details=True)
        except HTTPException as error:
            if error.status_code not in (400, 404, 409, 422):
                raise
            results.append({"change_id": str(change.id), "status": error.status_code, "detail": error.detail})
        else:
            results.append({"change_id": str(change.id), "status": 200, "result": result})
    return {"results": results}
