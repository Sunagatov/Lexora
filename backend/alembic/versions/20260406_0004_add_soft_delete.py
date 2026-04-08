"""add soft delete to words and topics

Revision ID: 20260406_0004
Revises: 20260406_0003
Create Date: 2026-04-06 20:00:00

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260406_0004"
down_revision = "20260406_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("words",  sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("topics", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_words_deleted_at",  "words",  ["deleted_at"])
    op.create_index("ix_topics_deleted_at", "topics", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_words_deleted_at",  table_name="words")
    op.drop_index("ix_topics_deleted_at", table_name="topics")
    op.drop_column("words",  "deleted_at")
    op.drop_column("topics", "deleted_at")
