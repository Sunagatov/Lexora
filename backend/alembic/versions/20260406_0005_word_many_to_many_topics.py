"""word many-to-many topics

Revision ID: 20260406_0005
Revises: 20260406_0004
Create Date: 2026-04-06 21:00:00

Steps
-----
1. Create `word_topics` join table (word_id, topic_id).
2. Populate it from the existing `words.topic_id` column.
3. Drop the `topic_id` FK column from `words`.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260406_0005"
down_revision = "20260406_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create join table
    op.create_table(
        "word_topics",
        sa.Column("word_id", sa.Integer(), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.PrimaryKeyConstraint("word_id", "topic_id"),
    )
    op.create_index("ix_word_topics_word_id", "word_topics", ["word_id"])
    op.create_index("ix_word_topics_topic_id", "word_topics", ["topic_id"])

    # 2. Migrate existing data: every word already has a topic_id
    op.execute(
        "INSERT INTO word_topics (word_id, topic_id) "
        "SELECT id, topic_id FROM words WHERE topic_id IS NOT NULL"
    )

    # 3. Drop the old FK column — use batch mode so SQLAlchemy reflects the
    #    actual FK constraint name (Supabase may auto-generate a different name)
    with op.batch_alter_table("words", recreate="never") as batch_op:
        batch_op.drop_index("ix_words_topic_id")
        batch_op.drop_constraint("words_topic_id_fkey", type_="foreignkey")
        batch_op.drop_column("topic_id")


def downgrade() -> None:
    # Re-add topic_id (picks an arbitrary topic per word — best-effort rollback)
    op.add_column("words", sa.Column("topic_id", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE words w SET topic_id = ("
        "  SELECT topic_id FROM word_topics wt WHERE wt.word_id = w.id LIMIT 1"
        ")"
    )
    op.alter_column("words", "topic_id", nullable=False)
    op.create_foreign_key("words_topic_id_fkey", "words", "topics", ["topic_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_words_topic_id", "words", ["topic_id"])

    op.drop_index("ix_word_topics_topic_id", table_name="word_topics")
    op.drop_index("ix_word_topics_word_id", table_name="word_topics")
    op.drop_table("word_topics")
