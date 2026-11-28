from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.features.stats.entries import (
    LibraryGap,
    RevisitGroup,
    list_library_gap,
    list_revisit_words,
)
from app.features.stats.schemas import (
    LearningStatsResponse,
    LibraryStatsResponse,
    StatsEntryPage,
    StatsResponse,
    UsageEventCreate,
)
from app.features.stats.service import (
    compute_learning_stats,
    compute_library_stats,
    compute_stats,
    record_usage_event,
)
from app.shared.deps import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])
StatsDB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=StatsResponse)
def get_stats(db: StatsDB) -> StatsResponse:
    return compute_stats(db)


@router.get("/learning", response_model=LearningStatsResponse)
def get_learning_stats(db: StatsDB) -> LearningStatsResponse:
    return compute_learning_stats(db)


@router.get("/library", response_model=LibraryStatsResponse)
def get_library_stats(db: StatsDB) -> LibraryStatsResponse:
    return compute_library_stats(db)


@router.get("/library/entries", response_model=StatsEntryPage)
def get_library_entries(db: StatsDB, gap: LibraryGap, page: Annotated[int, Query(ge=1, le=100_000)] = 1) -> StatsEntryPage:
    return list_library_gap(db, gap, page)


@router.get("/learning/revisit", response_model=StatsEntryPage)
def get_revisit_entries(db: StatsDB, group: RevisitGroup, page: Annotated[int, Query(ge=1, le=100_000)] = 1) -> StatsEntryPage:
    return list_revisit_words(db, group, page)


@router.post("/usage", status_code=204)
def post_usage_event(payload: UsageEventCreate, db: StatsDB) -> None:
    record_usage_event(db, payload)
    db.commit()
