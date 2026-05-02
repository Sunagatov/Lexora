# word_collocations

**Status:** NEW table

Ordered list of collocations (natural word pairings) for a word. E.g., for "decision": "make a decision", "reach a decision".

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)` |
| `position` | `INT` | NO | — | Display order (0-based) |
| `value` | `TEXT` | NO | — | Collocation phrase |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_collocations_pkey` | PRIMARY KEY | `(id)` |
| `fk_word_collocations_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `uq_word_collocations_word_id_position` | UNIQUE | `(word_id, position)` |
| `uq_word_collocations_word_id_value` | UNIQUE | `(word_id, value)` |
| `ck_word_collocations_position` | CHECK | `position >= 0` |
| `ck_word_collocations_value` | CHECK | `value != ''` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_collocations_word_id` | `word_id` | NO | FK lookup |

## Relationships

- `word_id → words(id)` — many collocations per word. CASCADE delete.

## Design Notes

- **No `target_word_id`** — collocations are phrases, not single words. Linking to another word entry doesn't make sense here.
- **No `created_at` / `updated_at`** — collocations are enrichment data populated in bulk. Timestamps add no value. Simpler than translations/examples which have historical audit needs.
- **UNIQUE(word_id, value)** — prevents storing "make a decision" twice for the same word.
- Collocations are one of the hardest aspects of language learning. Knowing "heavy rain" (not "strong rain") is the difference between sounding natural and sounding like a textbook.
