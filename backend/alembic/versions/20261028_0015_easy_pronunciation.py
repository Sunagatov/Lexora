"""Keep beginner reading hints separate from IPA and audio."""

import sqlalchemy as sa

from alembic import op

revision = "20261028_0015"
down_revision = "20261027_0014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("words", sa.Column("pronunciation_easy", sa.Text(), nullable=True))
    op.add_column("words", sa.Column("pronunciation_note_ru", sa.Text(), nullable=True))


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT count(*) FROM words WHERE pronunciation_easy IS NOT NULL OR pronunciation_note_ru IS NOT NULL"
        )
    ):
        raise RuntimeError("Reading hints exist; preserve them before removing these columns")
    op.drop_column("words", "pronunciation_note_ru")
    op.drop_column("words", "pronunciation_easy")
