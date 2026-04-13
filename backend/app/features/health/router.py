from fastapi import APIRouter

from app.shared.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/config/public")
def public_config() -> dict:
    return {"trash_retention_days": settings.trash_retention_days}
