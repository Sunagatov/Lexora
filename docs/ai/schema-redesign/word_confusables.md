# word_confusables

**Status:** NEW table

Ordered list of commonly confused words. E.g., for "affect": "effect" with explanation "affect = verb (to influence), effect = noun (result)".

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)`, the word this confusable belongs to |
| `position` | `INT` | NO | — | Display order (0-based) |
| `value` | `TEXT` | NO | — | The confusable word/phrase text |
| `target_word_id` | `INT` | YES | `NULL` | FK → `words(id)`, optional link to the confusable's own word entry |
| `explanation` | `TEXT` | YES | `NULL` | Why these words are confused and how to distinguish them |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_confusables_pkey` | PRIMARY KEY | `(id)` |
| `fk_word_confusables_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `fk_word_confusables_target` | FOREIGN KEY | `target_word_id → words(id) ON DELETE SET NULL` |
| `uq_word_confusables_word_id_position` | UNIQUE | `(word_id, position)` |
| `uq_word_confusables_word_id_value` | UNIQUE | `(word_id, value)` |
| `ck_word_confusables_position` | CHECK | `position >= 0` |
| `ck_word_confusables_value` | CHECK | `value != ''` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_confusables_word_id` | `word_id` | NO | FK lookup |
| `ix_word_confusables_target_word_id` | `target_word_id` | NO | Reverse lookup |

## Relationships

- `word_id → words(id)` — many confusables per word. CASCADE delete.
- `target_word_id → words(id)` — optional link. SET NULL on delete.

## Design Notes

- **Has `explanation`** — unlike synonyms/antonyms, confusables need context. "affect vs effect" is useless without explaining the difference.
- **Same `value` + `target_word_id` pattern as synonyms** — text is always stored for display; the FK link is optional for navigation.
- **Confusable pairs are not automatically bidirectional** — if "affect" lists "effect" as a confusable, "effect" should also list "affect". The application layer should handle this during enrichment, not the schema.
