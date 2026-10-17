"""Merge Basic ratings into Okay without dropping words or history events.

Revision ID: 20261017_0011
Revises: 20260515_0009
"""
from alembic import op

revision = "20261017_0011"
down_revision = "20260515_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE words SET knowledge_level = 3 WHERE knowledge_level = 2")
    op.execute("UPDATE word_progress_events SET old_level = 3 WHERE old_level = 2")
    op.execute("UPDATE word_progress_events SET new_level = 3 WHERE new_level = 2")
    with op.batch_alter_table("words") as batch:
        batch.drop_constraint("ck_words_knowledge_level", type_="check")
        batch.create_check_constraint("ck_words_knowledge_level", "knowledge_level IN (1, 3, 4, 5)")


def downgrade() -> None:
    # The categories cannot be separated again without the pre-migration backup.
    # A schema rollback allows old clients, while retaining all merged ratings.
    with op.batch_alter_table("words") as batch:
        batch.drop_constraint("ck_words_knowledge_level", type_="check")
        batch.create_check_constraint("ck_words_knowledge_level", "knowledge_level BETWEEN 1 AND 5")
