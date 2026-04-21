"""add app_usage_events table

Revision ID: 20260421_0004_usage_events
Revises: 20260421_0003_parent_topic
Create Date: 2026-04-21 18:15:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260421_0004_usage_events"
down_revision = "20260421_0003_parent_topic"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_usage_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_key", sa.String(64), nullable=False, unique=True),
        sa.Column("session_key", sa.String(64), nullable=False),
        sa.Column("route", sa.String(128), nullable=True),
        sa.Column("active_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_app_usage_events_session_key", "app_usage_events", ["session_key"], unique=False)
    op.create_index("ix_app_usage_events_created_at", "app_usage_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_app_usage_events_created_at", table_name="app_usage_events")
    op.drop_index("ix_app_usage_events_session_key", table_name="app_usage_events")
    op.drop_table("app_usage_events")
