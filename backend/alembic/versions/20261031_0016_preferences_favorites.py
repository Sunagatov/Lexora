"""Single-owner preferences and language-scoped word favorites."""

import sqlalchemy as sa

from alembic import op

revision = "20261031_0016"
down_revision = "20261028_0015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "words", sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.create_table(
        "app_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_app_preferences_single_owner"),
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM words WHERE is_favorite")
    ) or op.get_bind().scalar(sa.text("SELECT count(*) FROM app_preferences")):
        raise RuntimeError("Preserve favorites and preferences before removing them")
    op.drop_table("app_preferences")
    op.drop_column("words", "is_favorite")
