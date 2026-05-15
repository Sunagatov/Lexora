"""default knowledge_level to weak

Revision ID: 20260515_0009
Revises: 20260515_0008
Create Date: 2026-05-15 18:47:00
"""
from __future__ import annotations

from alembic import op

revision = "20260515_0009"
down_revision = "20260515_0008"


def upgrade() -> None:
    op.execute("UPDATE words SET knowledge_level = 1 WHERE knowledge_level IS NULL")
    op.alter_column("words", "knowledge_level", server_default="1")


def downgrade() -> None:
    op.alter_column("words", "knowledge_level", server_default=None)
