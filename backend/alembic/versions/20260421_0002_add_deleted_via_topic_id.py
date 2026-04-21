"""add deleted_via_topic_id to words

Revision ID: 20260421_0002
Revises: 20260421_0001
Create Date: 2026-04-21 13:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260421_0002"
down_revision = "20260421_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("words")}
    indexes = {index["name"] for index in insp.get_indexes("words")}

    if "deleted_via_topic_id" not in columns:
        op.add_column(
            "words",
            sa.Column(
                "deleted_via_topic_id",
                sa.Integer(),
                sa.ForeignKey("topics.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
    if "ix_words_deleted_via_topic_id" not in indexes:
        op.create_index("ix_words_deleted_via_topic_id", "words", ["deleted_via_topic_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "ix_words_deleted_via_topic_id" in {index["name"] for index in insp.get_indexes("words")}:
        op.drop_index("ix_words_deleted_via_topic_id", table_name="words")
    if "deleted_via_topic_id" in {col["name"] for col in insp.get_columns("words")}:
        op.drop_column("words", "deleted_via_topic_id")
