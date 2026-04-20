"""add multi-value translations/examples support

Revision ID: 20260421_0001
Revises: 20260406_0006
Create Date: 2026-04-21 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260421_0001"
down_revision = "20260406_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
    op.create_index("ix_word_translations_word_id", "word_translations", ["word_id"])

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
    op.create_index("ix_word_examples_word_id", "word_examples", ["word_id"])

    op.execute(
        """
        INSERT INTO word_translations (word_id, position, value, created_at, updated_at)
        SELECT word_id, row_number() OVER (PARTITION BY word_id ORDER BY ordinality) - 1, value, now(), now()
        FROM (
            SELECT
                w.id AS word_id,
                s.ordinality,
                btrim(s.value) AS value
            FROM words w
            CROSS JOIN LATERAL regexp_split_to_table(
                regexp_replace(w.translations, E'\\s*;\\s*', E'\\n', 'g'),
                E'\\n'
            ) WITH ORDINALITY AS s(value, ordinality)
            WHERE w.translations IS NOT NULL
              AND btrim(w.translations) <> ''
              AND btrim(s.value) <> ''
        ) split_values
        """
    )

    op.execute(
        """
        INSERT INTO word_examples (word_id, position, value, created_at, updated_at)
        SELECT word_id, row_number() OVER (PARTITION BY word_id ORDER BY ordinality) - 1, value, now(), now()
        FROM (
            SELECT
                w.id AS word_id,
                s.ordinality,
                btrim(s.value) AS value
            FROM words w
            CROSS JOIN LATERAL regexp_split_to_table(w.example, E'\\n') WITH ORDINALITY AS s(value, ordinality)
            WHERE w.example IS NOT NULL
              AND btrim(w.example) <> ''
              AND btrim(s.value) <> ''
        ) split_values
        """
    )


def downgrade() -> None:
    op.drop_index("ix_word_examples_word_id", table_name="word_examples")
    op.drop_table("word_examples")

    op.drop_index("ix_word_translations_word_id", table_name="word_translations")
    op.drop_table("word_translations")
