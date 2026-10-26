"""Store workbook previews and import recovery receipts.

Revision ID: 20261014_0010
Revises: 20261017_0012
"""

import sqlalchemy as sa

from alembic import op

revision = "20261014_0010"
down_revision = "20261017_0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workbook_import_batches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("plan_hash", sa.String(64), nullable=False),
        sa.Column("source", sa.JSON(), nullable=False),
        sa.Column("plan", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade():
    op.drop_table("workbook_import_batches")
