"""Durable receipts for retry-safe offline edits."""

from alembic import op
import sqlalchemy as sa

revision = "20261017_0012"
down_revision = "20261017_0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "offline_receipts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade():
    op.drop_table("offline_receipts")
