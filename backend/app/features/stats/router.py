from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.stats.schemas import StatsResponse, UsageEventCreate
from app.features.stats.service import compute_stats, record_usage_event

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    return compute_stats(db)


@router.post("/usage", status_code=204)
def post_usage_event(payload: UsageEventCreate, db: Session = Depends(get_db)) -> None:
    record_usage_event(db, payload)
    db.commit()
