"""Preserve the existing English library while adding multilingual namespaces."""

import sqlalchemy as sa
from alembic import op

revision = "20261027_0013"
down_revision = "20261014_0010"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("topics", "study_queues", "app_usage_events"):
        op.add_column(table, sa.Column("language", sa.String(2), server_default="en", nullable=False))
        op.create_index(f"ix_{table}_language", table, ["language"])
    op.add_column("words", sa.Column("transliteration", sa.Text(), nullable=True))
    op.add_column("words", sa.Column("explanation_groups", sa.JSON(), nullable=True))
    op.add_column("word_translations", sa.Column("language", sa.String(2), server_default="ru", nullable=False))
    with op.batch_alter_table("words") as batch:
        batch.drop_constraint("ck_words_language", type_="check")
        batch.create_check_constraint("ck_words_language", "language IN ('en','ru','zh','es','de','tr','tt','ar','fr','pt')")
    with op.batch_alter_table("word_translations") as batch:
        batch.drop_constraint("uq_word_translations_word_id_position", type_="unique")
        batch.create_unique_constraint("uq_word_translations_word_language_position", ["word_id", "language", "position"])
    inspector = sa.inspect(op.get_bind())
    unique_slugs = [item for item in inspector.get_unique_constraints("topics") if item["column_names"] == ["slug"]]
    for index in inspector.get_indexes("topics"):
        if index.get("unique") and not index.get("duplicates_constraint") and index["column_names"] == ["slug"]:
            op.drop_index(index["name"], table_name="topics")
    with op.batch_alter_table("topics") as batch:
        for constraint in unique_slugs:
            batch.drop_constraint(constraint["name"], type_="unique")
        batch.create_unique_constraint("uq_topics_slug_language", ["slug", "language"])


def downgrade():
    db = op.get_bind()
    checks = [
        "SELECT count(*) FROM words WHERE language NOT IN ('en','ru') OR transliteration IS NOT NULL OR explanation_groups IS NOT NULL",
        "SELECT count(*) FROM word_translations WHERE language <> 'ru'",
        *[f"SELECT count(*) FROM {table} WHERE language <> 'en'" for table in ("topics", "study_queues", "app_usage_events")],
    ]
    if any(db.scalar(sa.text(query)) for query in checks):
        raise RuntimeError("Multilingual data exists; restore a verified pre-migration backup instead of dropping language information")
    with op.batch_alter_table("topics") as batch:
        batch.drop_constraint("uq_topics_slug_language", type_="unique")
    op.create_index("ix_topics_slug", "topics", ["slug"], unique=True)
    with op.batch_alter_table("word_translations") as batch:
        batch.drop_constraint("uq_word_translations_word_language_position", type_="unique")
        batch.create_unique_constraint("uq_word_translations_word_id_position", ["word_id", "position"])
        batch.drop_column("language")
    with op.batch_alter_table("words") as batch:
        batch.drop_constraint("ck_words_language", type_="check")
        batch.create_check_constraint("ck_words_language", "language IN ('en','ru')")
        batch.drop_column("transliteration")
        batch.drop_column("explanation_groups")
    for table in ("topics", "study_queues", "app_usage_events"):
        op.drop_index(f"ix_{table}_language", table_name=table)
        with op.batch_alter_table(table) as batch:
            batch.drop_column("language")
