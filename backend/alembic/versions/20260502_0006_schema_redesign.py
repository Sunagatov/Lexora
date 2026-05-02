"""schema redesign: new tables, new columns, dropped columns, constraints

Revision ID: 20260502_0006
Revises: 20260426_0005
Create Date: 2026-05-02 21:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260502_0006"
down_revision = "20260426_0005"
branch_labels = None
depends_on = None

POS_SEED = ["noun", "verb", "adjective", "adverb", "phrase", "preposition", "phrasal verb", "other"]


def upgrade() -> None:
    # ── 1. parts_of_speech lookup table ──
    op.create_table(
        "parts_of_speech",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.UniqueConstraint("name", name="uq_parts_of_speech_name"),
    )
    bind = op.get_bind()
    for name in POS_SEED:
        bind.execute(sa.text("INSERT INTO parts_of_speech (name) VALUES (:n)"), {"n": name})

    # ── 2. topics: add UNIQUE(name), CHECK(no self-ref) ──
    op.create_unique_constraint("uq_topics_name", "topics", ["name"])
    op.create_check_constraint("ck_topics_no_self_ref", "topics", "id != parent_topic_id")

    # ── 3. words: add new columns ──
    op.add_column("words", sa.Column("language", sa.String(2), nullable=False, server_default="en"))
    op.add_column("words", sa.Column("definition", sa.Text(), nullable=True))
    op.add_column("words", sa.Column("pronunciation_ipa", sa.String(255), nullable=True))
    op.add_column("words", sa.Column("pronunciation_audio_url", sa.String(512), nullable=True))
    op.add_column("words", sa.Column("image_url", sa.String(512), nullable=True))
    op.add_column("words", sa.Column("part_of_speech_id", sa.Integer(), nullable=True))
    op.add_column("words", sa.Column("cefr_level", sa.String(2), nullable=True))
    op.add_column("words", sa.Column("register", sa.String(20), nullable=True))
    op.add_column("words", sa.Column("frequency_rank", sa.Integer(), nullable=True))

    # ── 4. Migrate part_of_speech text → part_of_speech_id FK ──
    bind.execute(sa.text("""
        UPDATE words w
        SET part_of_speech_id = p.id
        FROM parts_of_speech p
        WHERE lower(w.part_of_speech) = p.name
          AND w.part_of_speech IS NOT NULL
    """))

    # ── 5. Migrate verb forms to word_verb_forms ──
    op.create_table(
        "word_verb_forms",
        sa.Column("word_id", sa.Integer(), primary_key=True),
        sa.Column("past_simple", sa.String(255), nullable=True),
        sa.Column("past_participle", sa.String(255), nullable=True),
        sa.Column("present_participle", sa.String(255), nullable=True),
        sa.Column("third_person", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
    )
    bind.execute(sa.text("""
        INSERT INTO word_verb_forms (word_id, past_simple, past_participle)
        SELECT id, past_simple, past_participle
        FROM words
        WHERE past_simple IS NOT NULL OR past_participle IS NOT NULL
    """))

    # ── 6. Drop old columns from words ──
    op.drop_column("words", "translations")
    op.drop_column("words", "example")
    op.drop_column("words", "past_simple")
    op.drop_column("words", "past_participle")
    op.drop_column("words", "part_of_speech")

    # ── 7. Drop old unique index, add new constraints on words ──
    op.execute("DROP INDEX IF EXISTS uq_words_normalized_term")
    op.create_foreign_key("fk_words_pos", "words", "parts_of_speech", ["part_of_speech_id"], ["id"])
    op.create_unique_constraint("uq_words_term_pos_lang", "words", ["term", "part_of_speech_id", "language"])
    op.create_index("ix_words_language", "words", ["language"])
    op.create_check_constraint("ck_words_language", "words", "language IN ('en', 'ru')")
    op.create_check_constraint("ck_words_cefr_level", "words", "cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')")
    op.create_check_constraint("ck_words_register", "words", "register IN ('formal', 'informal', 'neutral', 'slang', 'technical')")
    op.create_check_constraint("ck_words_countability", "words", "countability IN ('countable', 'uncountable', 'both', 'plural', 'collective')")
    op.create_check_constraint("ck_words_knowledge_level", "words", "knowledge_level BETWEEN 1 AND 5")
    op.create_check_constraint("ck_words_frequency_rank", "words", "frequency_rank >= 1")

    # ── 8. Lowercase-normalize existing countability values ──
    bind.execute(sa.text("UPDATE words SET countability = lower(countability) WHERE countability IS NOT NULL"))

    # ── 9. word_translations / word_examples: drop timestamps, add CHECKs ──
    op.drop_column("word_translations", "created_at")
    op.drop_column("word_translations", "updated_at")
    op.drop_column("word_examples", "created_at")
    op.drop_column("word_examples", "updated_at")
    op.create_check_constraint("ck_word_translations_position", "word_translations", "position >= 0")
    op.create_check_constraint("ck_word_translations_value", "word_translations", "value != ''")
    op.create_check_constraint("ck_word_examples_position", "word_examples", "position >= 0")
    op.create_check_constraint("ck_word_examples_value", "word_examples", "value != ''")

    # ── 10. New entry tables ──
    _create_entry_table("word_synonyms", has_target=True)
    _create_entry_table("word_antonyms", has_target=True)
    _create_entry_table("word_collocations", has_target=False)
    _create_entry_table("word_confusables", has_target=True, has_explanation=True)

    # ── 11. word_progress_events: add CHECKs ──
    op.create_check_constraint("ck_wpe_old_level", "word_progress_events", "old_level BETWEEN 1 AND 5")
    op.create_check_constraint("ck_wpe_new_level", "word_progress_events", "new_level BETWEEN 1 AND 5")
    op.create_check_constraint(
        "ck_wpe_source", "word_progress_events",
        "source IN ('manual', 'study_list', 'smart_review', 'quick_add', 'bulk_import', 'xlsx_import', 'json_import')",
    )


def _create_entry_table(name: str, *, has_target: bool = False, has_explanation: bool = False) -> None:
    columns = [
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
    ]
    if has_target:
        columns.append(sa.Column("target_word_id", sa.Integer(), nullable=True))
    if has_explanation:
        columns.append(sa.Column("explanation", sa.Text(), nullable=True))

    constraints = [
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("word_id", "position", name=f"uq_{name}_word_id_position"),
        sa.UniqueConstraint("word_id", "value", name=f"uq_{name}_word_id_value"),
        sa.CheckConstraint("position >= 0", name=f"ck_{name}_position"),
        sa.CheckConstraint("value != ''", name=f"ck_{name}_value"),
    ]
    if has_target:
        constraints.append(
            sa.ForeignKeyConstraint(["target_word_id"], ["words.id"], ondelete="SET NULL"),
        )

    op.create_table(name, *columns, *constraints)
    op.create_index(f"ix_{name}_word_id", name, ["word_id"])
    if has_target:
        op.create_index(f"ix_{name}_target_word_id", name, ["target_word_id"])


def downgrade() -> None:
    # ── Drop CHECK constraints on progress events ──
    op.drop_constraint("ck_wpe_source", "word_progress_events", type_="check")
    op.drop_constraint("ck_wpe_new_level", "word_progress_events", type_="check")
    op.drop_constraint("ck_wpe_old_level", "word_progress_events", type_="check")

    # ── Drop new entry tables ──
    for name in ("word_confusables", "word_collocations", "word_antonyms", "word_synonyms"):
        op.drop_index(f"ix_{name}_word_id", table_name=name)
        if name in ("word_confusables", "word_antonyms", "word_synonyms"):
            op.drop_index(f"ix_{name}_target_word_id", table_name=name)
        op.drop_table(name)

    # ── Restore timestamps on entry tables, drop CHECKs ──
    op.drop_constraint("ck_word_examples_value", "word_examples", type_="check")
    op.drop_constraint("ck_word_examples_position", "word_examples", type_="check")
    op.drop_constraint("ck_word_translations_value", "word_translations", type_="check")
    op.drop_constraint("ck_word_translations_position", "word_translations", type_="check")
    op.add_column("word_examples", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("word_examples", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("word_translations", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("word_translations", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))

    # ── Drop word constraints and indexes ──
    op.drop_constraint("ck_words_frequency_rank", "words", type_="check")
    op.drop_constraint("ck_words_knowledge_level", "words", type_="check")
    op.drop_constraint("ck_words_countability", "words", type_="check")
    op.drop_constraint("ck_words_register", "words", type_="check")
    op.drop_constraint("ck_words_cefr_level", "words", type_="check")
    op.drop_constraint("ck_words_language", "words", type_="check")
    op.drop_index("ix_words_language", table_name="words")
    op.drop_constraint("uq_words_term_pos_lang", "words", type_="unique")
    op.drop_constraint("fk_words_pos", "words", type_="foreignkey")

    # ── Restore old unique index ──
    normalized = r"lower(regexp_replace(btrim(term), '\s+', ' ', 'g'))"
    op.execute(f"CREATE UNIQUE INDEX uq_words_normalized_term ON words ({normalized})")

    # ── Restore dropped columns on words ──
    op.add_column("words", sa.Column("part_of_speech", sa.String(50), nullable=True))
    op.add_column("words", sa.Column("past_participle", sa.String(255), nullable=True))
    op.add_column("words", sa.Column("past_simple", sa.String(255), nullable=True))
    op.add_column("words", sa.Column("example", sa.Text(), nullable=True))
    op.add_column("words", sa.Column("translations", sa.Text(), nullable=False, server_default=""))

    # ── Migrate verb forms back ──
    bind = op.get_bind()
    bind.execute(sa.text("""
        UPDATE words w
        SET past_simple = vf.past_simple, past_participle = vf.past_participle
        FROM word_verb_forms vf
        WHERE vf.word_id = w.id
    """))
    # ── Migrate part_of_speech_id back to text ──
    bind.execute(sa.text("""
        UPDATE words w
        SET part_of_speech = p.name
        FROM parts_of_speech p
        WHERE w.part_of_speech_id = p.id
    """))

    # ── Drop new columns from words ──
    op.drop_column("words", "frequency_rank")
    op.drop_column("words", "register")
    op.drop_column("words", "cefr_level")
    op.drop_column("words", "part_of_speech_id")
    op.drop_column("words", "image_url")
    op.drop_column("words", "pronunciation_audio_url")
    op.drop_column("words", "pronunciation_ipa")
    op.drop_column("words", "definition")
    op.drop_column("words", "language")

    # ── Drop word_verb_forms ──
    op.drop_table("word_verb_forms")

    # ── Drop topics constraints ──
    op.drop_constraint("ck_topics_no_self_ref", "topics", type_="check")
    op.drop_constraint("uq_topics_name", "topics", type_="unique")

    # ── Drop parts_of_speech ──
    op.drop_table("parts_of_speech")
