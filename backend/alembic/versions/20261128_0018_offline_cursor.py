"""Commit-ordered revisions for the offline catalog."""

from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "20261128_0018"
down_revision = "20261107_0017"
branch_labels = None
depends_on = None

CATALOG_TABLES = {
    "words": ("word", "id"),
    "topics": ("topic", "id"),
    "word_topics": ("word", "word_id"),
    "word_translations": ("word", "word_id"),
    "word_examples": ("word", "word_id"),
    "word_verb_forms": ("word", "word_id"),
    "word_synonyms": ("word", "word_id"),
    "word_antonyms": ("word", "word_id"),
    "word_collocations": ("word", "word_id"),
    "word_confusables": ("word", "word_id"),
}


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return

    epoch = op.create_table(
        "offline_catalog_epoch",
        sa.Column("singleton", sa.Boolean(), primary_key=True),
        sa.Column("epoch", sa.String(32), nullable=False),
        sa.CheckConstraint("singleton", name="ck_offline_catalog_epoch_singleton"),
    )
    op.bulk_insert(epoch, [{"singleton": True, "epoch": uuid4().hex}])
    op.execute("CREATE SEQUENCE offline_catalog_revision_seq AS bigint")
    op.create_table(
        "offline_catalog_changes",
        sa.Column("revision", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.String(5), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("revision", "kind", "entity_id"),
    )

    # Assign the revision when the deferred triggers run and hold the lock to
    # transaction end. A lower revision cannot commit after a higher one.
    # Appending also works for concurrent write transactions at REPEATABLE READ.
    op.execute("""
        CREATE FUNCTION offline_catalog_record(change_kind text, change_id integer)
        RETURNS void LANGUAGE plpgsql AS $$
        DECLARE
            change_revision bigint;
        BEGIN
            change_revision := nullif(current_setting('lexora.offline_catalog_revision', true), '')::bigint;
            IF change_revision IS NULL THEN
                PERFORM pg_advisory_xact_lock(1279611471, 18);
                change_revision := nextval('offline_catalog_revision_seq');
                PERFORM set_config('lexora.offline_catalog_revision', change_revision::text, true);
            END IF;
            INSERT INTO offline_catalog_changes (revision, kind, entity_id)
            VALUES (change_revision, change_kind, change_id)
            ON CONFLICT DO NOTHING;
        END;
        $$
    """)
    op.execute("""
        CREATE FUNCTION offline_catalog_track_row()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            old_id integer;
            new_id integer;
        BEGIN
            IF TG_ARGV[1] = 'id' THEN
                IF TG_OP <> 'INSERT' THEN old_id := OLD.id; END IF;
                IF TG_OP <> 'DELETE' THEN new_id := NEW.id; END IF;
            ELSE
                IF TG_OP <> 'INSERT' THEN old_id := OLD.word_id; END IF;
                IF TG_OP <> 'DELETE' THEN new_id := NEW.word_id; END IF;
            END IF;
            IF old_id IS NOT NULL AND old_id IS DISTINCT FROM new_id THEN
                PERFORM offline_catalog_record(TG_ARGV[0], old_id);
            END IF;
            IF new_id IS NOT NULL THEN
                PERFORM offline_catalog_record(TG_ARGV[0], new_id);
            END IF;
            RETURN NULL;
        END;
        $$
    """)
    op.execute("""
        CREATE FUNCTION offline_catalog_track_part_of_speech()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF OLD.name IS DISTINCT FROM NEW.name OR OLD.id IS DISTINCT FROM NEW.id THEN
                PERFORM offline_catalog_record('word', words.id)
                FROM words WHERE part_of_speech_id IN (OLD.id, NEW.id);
            END IF;
            RETURN NULL;
        END;
        $$
    """)
    op.execute("""
        CREATE FUNCTION offline_catalog_reseed()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            UPDATE offline_catalog_epoch
            SET epoch = replace(gen_random_uuid()::text, '-', '')
            WHERE singleton;
            RETURN NULL;
        END;
        $$
    """)

    for table, (kind, key) in CATALOG_TABLES.items():
        op.execute(f"""
            CREATE CONSTRAINT TRIGGER offline_catalog_row
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
            EXECUTE FUNCTION offline_catalog_track_row('{kind}', '{key}')
        """)
    op.execute("""
        CREATE CONSTRAINT TRIGGER offline_catalog_row
        AFTER UPDATE ON parts_of_speech
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION offline_catalog_track_part_of_speech()
    """)
    for table in (*CATALOG_TABLES, "parts_of_speech"):
        op.execute(f"""
            CREATE TRIGGER offline_catalog_truncate
            AFTER TRUNCATE ON {table} FOR EACH STATEMENT
            EXECUTE FUNCTION offline_catalog_reseed()
        """)
    op.execute("ALTER TABLE offline_catalog_epoch ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE offline_catalog_changes ENABLE ROW LEVEL SECURITY")
    op.execute("""
        DO $$
        DECLARE role_name text;
        BEGIN
          FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
              EXECUTE format('REVOKE ALL ON TABLE offline_catalog_epoch, offline_catalog_changes FROM %I', role_name);
              EXECUTE format('REVOKE ALL ON SEQUENCE offline_catalog_revision_seq FROM %I', role_name);
              EXECUTE format('REVOKE ALL ON FUNCTION offline_catalog_record(text, integer), offline_catalog_track_row(),
                  offline_catalog_track_part_of_speech(), offline_catalog_reseed() FROM %I', role_name);
            END IF;
          END LOOP;
          REVOKE ALL ON FUNCTION offline_catalog_record(text, integer), offline_catalog_track_row(),
              offline_catalog_track_part_of_speech(), offline_catalog_reseed() FROM PUBLIC;
        END $$;
    """)


def downgrade():
    if op.get_bind().dialect.name != "postgresql":
        return

    for table in (*CATALOG_TABLES, "parts_of_speech"):
        op.execute(f"DROP TRIGGER offline_catalog_truncate ON {table}")
        op.execute(f"DROP TRIGGER offline_catalog_row ON {table}")
    op.execute("DROP FUNCTION offline_catalog_reseed()")
    op.execute("DROP FUNCTION offline_catalog_track_part_of_speech()")
    op.execute("DROP FUNCTION offline_catalog_track_row()")
    op.execute("DROP FUNCTION offline_catalog_record(text, integer)")
    op.drop_table("offline_catalog_changes")
    op.execute("DROP SEQUENCE offline_catalog_revision_seq")
    op.drop_table("offline_catalog_epoch")
