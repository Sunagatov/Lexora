"""add parent_topic_id to topics

Revision ID: 20260421_0003_add_parent_topic_id
Revises: 20260421_0002_add_deleted_via_topic_id
Create Date: 2026-04-21 16:20:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260421_0003_add_parent_topic_id"
down_revision = "20260421_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("parent_topic_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_topics_parent_topic_id_topics",
        "topics",
        "topics",
        ["parent_topic_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_topics_parent_topic_id"), "topics", ["parent_topic_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_topics_parent_topic_id"), table_name="topics")
    op.drop_constraint("fk_topics_parent_topic_id_topics", "topics", type_="foreignkey")
    op.drop_column("topics", "parent_topic_id")
