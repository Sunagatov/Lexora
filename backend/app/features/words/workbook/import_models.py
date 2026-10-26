"""Durable previews and receipts make applying an import safe to retry."""

from datetime import datetime

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


class WorkbookImportBatch(Base):
    __tablename__ = "workbook_import_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    plan_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[dict] = mapped_column(JSON)
    plan: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
