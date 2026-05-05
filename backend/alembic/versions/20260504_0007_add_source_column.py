"""add source column to words

Revision ID: 20260504_0007
Revises: 20260502_0006
Create Date: 2026-05-04 19:40:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260504_0007"
down_revision = "20260502_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_name='words' AND column_name='source'"
    ))
    if not result.fetchone():
        op.add_column(
            "words",
            sa.Column("source", sa.String(10), nullable=False, server_default="manual"),
        )
        op.create_check_constraint(
            "ck_words_source",
            "words",
            "source IN ('manual', 'import')",
        )
        op.execute(
            "UPDATE words SET source = 'import' WHERE created_at < '2026-01-02'"
        )
        op.create_index("ix_words_source", "words", ["source"])


def downgrade() -> None:
    op.drop_index("ix_words_source", table_name="words")
    op.drop_constraint("ck_words_source", "words", type_="check")
    op.drop_column("words", "source")
