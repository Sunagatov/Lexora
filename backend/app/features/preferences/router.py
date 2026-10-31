from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.shared.deps import get_db

from .schemas import Preferences, PreferencesPatch
from .service import get_preferences, update_preferences

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("", response_model=Preferences)
def read_preferences(db: Annotated[Session, Depends(get_db)]):
    return get_preferences(db)


@router.patch("", response_model=Preferences)
def save_preferences(patch: PreferencesPatch, db: Annotated[Session, Depends(get_db)]):
    return update_preferences(db, patch)
