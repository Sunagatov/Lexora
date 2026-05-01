from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


class AppUsageEvent(Base):
    __tablename__ = "app_usage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    session_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    route: Mapped[str | None] = mapped_column(String(128), nullable=True)
    active_seconds: Mapped[int] = mapped_column(Integer(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
