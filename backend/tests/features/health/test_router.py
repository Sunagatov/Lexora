from app.features.health.router import healthcheck, public_config
from app.shared.config import settings


def test_healthcheck_returns_ok() -> None:
    assert healthcheck() == {"status": "ok"}


def test_public_config_exposes_trash_retention_days() -> None:
    assert public_config() == {"trash_retention_days": settings.trash_retention_days}