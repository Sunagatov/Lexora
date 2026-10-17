from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.offline.service import OfflineChange, apply_change, snapshot
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


@router.get("/snapshot")
def get_snapshot(db: Annotated[Session, Depends(get_db)]):
    return snapshot(db)


@router.post("/changes")
def sync_change(change: OfflineChange, db: Annotated[Session, Depends(get_db)]):
    try:
        return apply_change(db, change)
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
