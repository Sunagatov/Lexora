"""Revocable owner sessions and durable login-attempt limits."""

import sqlalchemy as sa

from alembic import op

revision = "20261107_0017"
down_revision = "20261031_0016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("credential_tag", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.create_table(
        "auth_login_attempts",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("resets_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_auth_login_attempts_resets_at", "auth_login_attempts", ["resets_at"])


def downgrade():
    op.drop_index("ix_auth_login_attempts_resets_at", table_name="auth_login_attempts")
    op.drop_table("auth_login_attempts")
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_table("auth_sessions")
