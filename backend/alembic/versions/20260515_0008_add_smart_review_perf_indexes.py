"""add smart review performance indexes

Revision ID: 20260515_0008
Revises: 20260504_0007
Create Date: 2026-05-15 16:57:00
"""
from __future__ import annotations

from alembic import op

revision = "20260515_0008"
down_revision = "20260504_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_words_smart_review_candidates",
        "words",
        ["knowledge_level", "is_active", "deleted_at", "updated_at"],
    )
    op.create_index(
        "ix_study_queue_items_completed",
        "study_queue_items",
        ["is_completed", "completed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_study_queue_items_completed", table_name="study_queue_items")
    op.drop_index("ix_words_smart_review_candidates", table_name="words")
