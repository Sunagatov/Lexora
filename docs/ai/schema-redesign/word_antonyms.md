# word_antonyms

**Status:** NEW table

Ordered list of antonyms for a word. Same structure as `word_synonyms`.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)`, the word this antonym belongs to |
| `position` | `INT` | NO | — | Display order (0-based) |
| `value` | `TEXT` | NO | — | Antonym text (e.g. "small", "tiny") |
| `target_word_id` | `INT` | YES | `NULL` | FK → `words(id)`, optional link to the antonym's own word entry |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_antonyms_pkey` | PRIMARY KEY | `(id)` |
| `fk_word_antonyms_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `fk_word_antonyms_target` | FOREIGN KEY | `target_word_id → words(id) ON DELETE SET NULL` |
| `uq_word_antonyms_word_id_position` | UNIQUE | `(word_id, position)` |
| `uq_word_antonyms_word_id_value` | UNIQUE | `(word_id, value)` |
| `ck_word_antonyms_position` | CHECK | `position >= 0` |
| `ck_word_antonyms_value` | CHECK | `value != ''` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_antonyms_word_id` | `word_id` | NO | FK lookup |
| `ix_word_antonyms_target_word_id` | `target_word_id` | NO | Reverse lookup |

## Relationships

- `word_id → words(id)` — many antonyms per word. CASCADE delete.
- `target_word_id → words(id)` — optional link. SET NULL on delete.

## Design Notes

- Identical structure to `word_synonyms`. See [word_synonyms.md](word_synonyms.md) for detailed rationale on `value` + `target_word_id` pattern.
- Kept as a separate table (not a generic `word_related_words` with a `type` column) for clarity, simpler queries, and independent constraint tuning.
