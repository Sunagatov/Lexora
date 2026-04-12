"""add word_progress_events table

Revision ID: 20260406_0006
Revises: 20260406_0005
Create Date: 2026-04-06 22:00:00

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260406_0006"
down_revision = "20260406_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "word_progress_events",
        sa.Column("id",         sa.Integer(),                  primary_key=True),
        sa.Column("word_id",    sa.Integer(),                  sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("old_level",  sa.Integer(),                  nullable=True),
        sa.Column("new_level",  sa.Integer(),                  nullable=False),
        sa.Column("source",     sa.String(32),                 nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True),    server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_wpe_word_id",    "word_progress_events", ["word_id"])
    op.create_index("ix_wpe_created_at", "word_progress_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_wpe_created_at", table_name="word_progress_events")
    op.drop_index("ix_wpe_word_id",    table_name="word_progress_events")
    op.drop_table("word_progress_events")
