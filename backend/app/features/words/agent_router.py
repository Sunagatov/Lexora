from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.shared.deps import get_db, verify_api_key
from app.features.words.schemas import BulkImportResponse, WordBulkCreate
from app.features.words.bulk import (
    BulkInvalidTopicNameError,
    BulkSlugConflictError,
    BulkTopicInTrashError,
    bulk_import,
)

router = APIRouter(prefix="/api/words", tags=["words"])


@router.post(
    "/bulk",
    response_model=BulkImportResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_api_key)],
)
def bulk_create_words(payload: WordBulkCreate, db: Session = Depends(get_db)) -> BulkImportResponse:
    """Create or reuse a topic by name, then insert words skipping duplicates.
    Secured by X-Api-Key header."""
    try:
        return bulk_import(db, payload)
    except BulkInvalidTopicNameError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate a valid slug from topic name: '{e.name}'",
        )
    except BulkTopicInTrashError as e:
        msg = (
            f"Topic '{e.name}' exists but is in trash. "
            "Restore or permanently delete it first."
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
    except BulkSlugConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.detail)
