"""initial tables

Revision ID: 20260406_0001
Revises:
Create Date: 2026-04-06 12:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260406_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_topics_name", "topics", ["name"], unique=False)
    op.create_index("uq_topics_slug", "topics", ["slug"], unique=True)

    op.create_table(
        "words",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("term", sa.String(length=255), nullable=False),
        sa.Column("translations", sa.Text(), nullable=False),
        sa.Column("part_of_speech", sa.String(length=50), nullable=True),
        sa.Column("knowledge_level", sa.Integer(), nullable=True),
        sa.Column("countability", sa.String(length=50), nullable=True),
        sa.Column("pattern", sa.Text(), nullable=True),
        sa.Column("example", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_words_term", "words", ["term"], unique=False)
    op.create_index("ix_words_topic_id", "words", ["topic_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_words_topic_id", table_name="words")
    op.drop_index("ix_words_term", table_name="words")
    op.drop_table("words")

    op.drop_index("uq_topics_slug", table_name="topics")
    op.drop_index("ix_topics_name", table_name="topics")
    op.drop_table("topics")