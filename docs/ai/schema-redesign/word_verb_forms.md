# word_verb_forms

**Status:** NEW table

One-to-one table for verb-specific conjugation forms. Only verbs have a row here.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `word_id` | `INT` | NO | — | PK and FK → `words(id)` |
| `past_simple` | `VARCHAR(255)` | YES | `NULL` | e.g. "ran", "went" |
| `past_participle` | `VARCHAR(255)` | YES | `NULL` | e.g. "run", "gone" |
| `present_participle` | `VARCHAR(255)` | YES | `NULL` | e.g. "running", "going" |
| `third_person` | `VARCHAR(255)` | YES | `NULL` | e.g. "runs", "goes" |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_verb_forms_pkey` | PRIMARY KEY | `(word_id)` |
| `fk_word_verb_forms_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |

## Indexes

None beyond the primary key. The PK index is sufficient for the 1:1 join.

## Relationships

- `word_id → words(id)` — one-to-one. CASCADE delete: when a word is hard-deleted, its verb forms are deleted too.

## Changes from Current Schema

| Change | Before | After |
|--------|--------|-------|
| `past_simple` | Column on `words` | Moved here |
| `past_participle` | Column on `words` | Moved here |
| `present_participle` | Did not exist | NEW |
| `third_person` | Did not exist | NEW |

## Design Notes

- **1:1 via `word_id` as PK** — not a separate `id` column. One row per word, enforced by the primary key.
- **Only for verbs** — non-verb words simply have no row in this table. No wasted nullable columns on the `words` table.
- **All form columns are nullable** — regular verbs may not need explicit forms (they follow standard rules). Only irregular forms need to be stored.
- **No application-level enforcement** — the schema doesn't enforce that only verbs have rows here. The application layer should only create rows when `part_of_speech_id` corresponds to "verb" or "phrasal verb".
