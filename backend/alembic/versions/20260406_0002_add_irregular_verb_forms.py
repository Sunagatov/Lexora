"""add irregular verb forms columns

Revision ID: 20260406_0002
Revises: 20260406_0001
Create Date: 2026-04-06 18:30:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260406_0002"
down_revision = "20260406_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("words", sa.Column("past_simple", sa.String(length=255), nullable=True))
    op.add_column("words", sa.Column("past_participle", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("words", "past_participle")
    op.drop_column("words", "past_simple")