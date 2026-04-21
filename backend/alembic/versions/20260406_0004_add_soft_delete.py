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
    bind = op.get_bind()
    insp = sa.inspect(bind)

    word_columns = {col["name"] for col in insp.get_columns("words")}
    topic_columns = {col["name"] for col in insp.get_columns("topics")}

    if "deleted_at" not in word_columns:
        op.add_column("words", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if "deleted_at" not in topic_columns:
        op.add_column("topics", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    if "ix_words_deleted_at" not in {index["name"] for index in insp.get_indexes("words")}:
        op.create_index("ix_words_deleted_at", "words", ["deleted_at"])
    if "ix_topics_deleted_at" not in {index["name"] for index in insp.get_indexes("topics")}:
        op.create_index("ix_topics_deleted_at", "topics", ["deleted_at"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "ix_words_deleted_at" in {index["name"] for index in insp.get_indexes("words")}:
        op.drop_index("ix_words_deleted_at", table_name="words")
    if "ix_topics_deleted_at" in {index["name"] for index in insp.get_indexes("topics")}:
        op.drop_index("ix_topics_deleted_at", table_name="topics")

    if "deleted_at" in {col["name"] for col in insp.get_columns("words")}:
        op.drop_column("words", "deleted_at")
    if "deleted_at" in {col["name"] for col in insp.get_columns("topics")}:
        op.drop_column("topics", "deleted_at")
