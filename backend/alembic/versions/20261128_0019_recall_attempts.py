"""Persist recall outcomes across devices."""

import sqlalchemy as sa

from alembic import op

revision = "20261128_0019"
down_revision = "20261128_0018"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "lexora_recall_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("word_id", sa.Integer(), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("translation_language", sa.String(2), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recalled", sa.Boolean(), nullable=False),
    )
    op.create_index(
        "ix_lexora_recall_attempts_word_target_time", "lexora_recall_attempts",
        ["word_id", "translation_language", "occurred_at"],
    )
    op.create_index(
        "ix_lexora_recall_attempts_scope_time", "lexora_recall_attempts",
        ["language", "translation_language", "occurred_at"],
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE lexora_recall_attempts ENABLE ROW LEVEL SECURITY")
        op.execute("""
            DO $$
            DECLARE role_name text;
            BEGIN
              FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                  EXECUTE format('REVOKE ALL ON lexora_recall_attempts FROM %I', role_name);
                END IF;
              END LOOP;
            END $$;
        """)


def downgrade():
    op.drop_table("lexora_recall_attempts")
