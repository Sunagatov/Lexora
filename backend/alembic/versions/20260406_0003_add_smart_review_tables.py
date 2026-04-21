"""add smart review tables

Revision ID: 20260406_0003
Revises: 20260406_0002
Create Date: 2026-04-06 19:00:00

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260406_0003"
down_revision = "20260406_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("study_queues"):
        op.create_table(
            "study_queues",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("total_count", sa.Integer(), nullable=False),
            sa.Column("completed_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )

    if not insp.has_table("study_queue_items"):
        op.create_table(
            "study_queue_items",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("queue_id", sa.Integer(), nullable=False),
            sa.Column("word_id", sa.Integer(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["queue_id"], ["study_queues.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
        )

    if "ix_study_queue_items_queue_id" not in {index["name"] for index in insp.get_indexes("study_queue_items")}:
        op.create_index("ix_study_queue_items_queue_id", "study_queue_items", ["queue_id"])
    if "ix_study_queue_items_word_id" not in {index["name"] for index in insp.get_indexes("study_queue_items")}:
        op.create_index("ix_study_queue_items_word_id", "study_queue_items", ["word_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("study_queue_items"):
        op.drop_index("ix_study_queue_items_word_id", table_name="study_queue_items")
        op.drop_index("ix_study_queue_items_queue_id", table_name="study_queue_items")
        op.drop_table("study_queue_items")
    if insp.has_table("study_queues"):
        op.drop_table("study_queues")
