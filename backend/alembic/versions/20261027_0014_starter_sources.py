"""Allow stable starter identities alongside existing manual/import provenance."""

import sqlalchemy as sa

from alembic import op

revision = "20261027_0014"
down_revision = "20261027_0013"
branch_labels = None
depends_on = None


def _replace_source_check(expression):
    existing = sa.inspect(op.get_bind()).get_check_constraints("words")
    with op.batch_alter_table("words") as batch:
        if any(item["name"] == "ck_words_source" for item in existing):
            batch.drop_constraint("ck_words_source", type_="check")
        batch.create_check_constraint("ck_words_source", expression)


def upgrade():
    _replace_source_check("source IN ('manual', 'import') OR source LIKE 'start1s___'")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM words WHERE source NOT IN ('manual', 'import')")):
        raise RuntimeError("Starter entries exist; keep their tracking identities or restore a verified backup")
    _replace_source_check("source IN ('manual', 'import')")
