"""initial tables

Revision ID: 20260406_0001
Revises:
Create Date: 2026-04-06 18:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

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
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_topics_name", "topics", ["name"], unique=False)
    op.create_index("ix_topics_slug", "topics", ["slug"], unique=True)
    op.create_index("ix_topics_deleted_at", "topics", ["deleted_at"], unique=False)

    op.create_table(
        "words",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("term", sa.String(length=255), nullable=False),
        sa.Column("past_simple", sa.String(length=255), nullable=True),
        sa.Column("past_participle", sa.String(length=255), nullable=True),
        sa.Column("translations", sa.Text(), nullable=False),
        sa.Column("part_of_speech", sa.String(length=50), nullable=True),
        sa.Column("knowledge_level", sa.Integer(), nullable=True),
        sa.Column("countability", sa.String(length=50), nullable=True),
        sa.Column("pattern", sa.Text(), nullable=True),
        sa.Column("example", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "deleted_via_topic_id",
            sa.Integer(),
            sa.ForeignKey("topics.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_words_term", "words", ["term"], unique=False)
    op.create_index("ix_words_deleted_at", "words", ["deleted_at"], unique=False)
    op.create_index("ix_words_deleted_via_topic_id", "words", ["deleted_via_topic_id"], unique=False)

    op.create_table(
        "word_topics",
        sa.Column("word_id", sa.Integer(), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.PrimaryKeyConstraint("word_id", "topic_id"),
    )
    op.create_index("ix_word_topics_word_id", "word_topics", ["word_id"], unique=False)
    op.create_index("ix_word_topics_topic_id", "word_topics", ["topic_id"], unique=False)

    op.create_table(
        "word_translations",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("word_id", "position", name="uq_word_translations_word_id_position"),
    )
    op.create_index("ix_word_translations_word_id", "word_translations", ["word_id"], unique=False)

    op.create_table(
        "word_examples",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("word_id", "position", name="uq_word_examples_word_id_position"),
    )
    op.create_index("ix_word_examples_word_id", "word_examples", ["word_id"], unique=False)

    op.create_table(
        "study_queues",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("total_count", sa.Integer(), nullable=False),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

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
    op.create_index("ix_study_queue_items_queue_id", "study_queue_items", ["queue_id"], unique=False)
    op.create_index("ix_study_queue_items_word_id", "study_queue_items", ["word_id"], unique=False)

    op.create_table(
        "word_progress_events",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("old_level", sa.Integer(), nullable=True),
        sa.Column("new_level", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_wpe_word_id", "word_progress_events", ["word_id"], unique=False)
    op.create_index("ix_wpe_created_at", "word_progress_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_wpe_created_at", table_name="word_progress_events")
    op.drop_index("ix_wpe_word_id", table_name="word_progress_events")
    op.drop_table("word_progress_events")

    op.drop_index("ix_study_queue_items_word_id", table_name="study_queue_items")
    op.drop_index("ix_study_queue_items_queue_id", table_name="study_queue_items")
    op.drop_table("study_queue_items")
    op.drop_table("study_queues")

    op.drop_index("ix_word_examples_word_id", table_name="word_examples")
    op.drop_table("word_examples")

    op.drop_index("ix_word_translations_word_id", table_name="word_translations")
    op.drop_table("word_translations")

    op.drop_index("ix_word_topics_topic_id", table_name="word_topics")
    op.drop_index("ix_word_topics_word_id", table_name="word_topics")
    op.drop_table("word_topics")

    op.drop_index("ix_words_deleted_via_topic_id", table_name="words")
    op.drop_index("ix_words_deleted_at", table_name="words")
    op.drop_index("ix_words_term", table_name="words")
    op.drop_table("words")

    op.drop_index("ix_topics_deleted_at", table_name="topics")
    op.drop_index("ix_topics_slug", table_name="topics")
    op.drop_index("ix_topics_name", table_name="topics")
    op.drop_table("topics")
