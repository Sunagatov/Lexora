from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.shared.deps import get_db
from app.features.stats.schemas import StatsResponse
from app.features.stats.service import compute_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    return compute_stats(db)
