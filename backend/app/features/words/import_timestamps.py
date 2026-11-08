from datetime import UTC, datetime


def as_utc(value: datetime) -> datetime:
    """Database fallback and legacy exports represent naive timestamps in UTC."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
