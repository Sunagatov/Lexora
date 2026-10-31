from sqlalchemy import JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


class AppPreferences(Base):
    """Preferences for Lexora's single owner, shared by all devices/libraries."""

    __tablename__ = "app_preferences"
    __table_args__ = (CheckConstraint("id = 1", name="ck_app_preferences_single_owner"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    values: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
