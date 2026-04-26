"""add global normalized word uniqueness

Revision ID: 20260426_0005
Revises: 20260421_0004
Create Date: 2026-04-26 12:00:00
"""
from __future__ import annotations

from alembic import op

revision = "20260426_0005"
down_revision = "20260421_0004_usage_events"
branch_labels = None
depends_on = None

NORMALIZED_TERM_SQL = r"lower(regexp_replace(btrim(term), '\s+', ' ', 'g'))"


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.exec_driver_sql(
        f"""
        SELECT
            {NORMALIZED_TERM_SQL} AS normalized_term,
            array_agg(id ORDER BY id) AS word_ids
        FROM words
        GROUP BY {NORMALIZED_TERM_SQL}
        HAVING COUNT(*) > 1
        ORDER BY {NORMALIZED_TERM_SQL}
        LIMIT 10
        """
    ).fetchall()
    if rows:
        details = ", ".join(
            f"{row.normalized_term!r}: ids={list(row.word_ids)}"
            for row in rows
        )
        raise RuntimeError(
            "Cannot add unique normalized word constraint because duplicate words already exist. "
            f"Resolve duplicates first. Sample groups: {details}"
        )

    op.execute(
        f"CREATE UNIQUE INDEX uq_words_normalized_term ON words ({NORMALIZED_TERM_SQL})"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_words_normalized_term")
