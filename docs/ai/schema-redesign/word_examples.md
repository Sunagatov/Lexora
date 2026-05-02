# word_examples

**Status:** MODIFIED (adds CHECK constraints on `position` and `value`)

Ordered list of example sentences demonstrating word usage.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)` |
| `position` | `INT` | NO | — | Display order (0-based) |
| `value` | `TEXT` | NO | — | Example sentence |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_examples_pkey` | PRIMARY KEY | `(id)` |
| `fk_word_examples_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `uq_word_examples_word_id_position` | UNIQUE | `(word_id, position)` |
| `ck_word_examples_position` | CHECK | `position >= 0` |
| `ck_word_examples_value` | CHECK | `value != ''` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_examples_word_id` | `word_id` | NO | FK lookup and join performance |

## Relationships

- `word_id → words(id)` — many examples per word. CASCADE delete.

## Changes from Current Schema

| Change | Before | After |
|--------|--------|-------|
| `position` validation | No CHECK | CHECK `position >= 0` |
| `value` validation | No CHECK | CHECK `value != ''` |
| `created_at` | Present | DROPPED |
| `updated_at` | Present | DROPPED |

## Design Notes

- **This is now the only source of examples.** The flat `words.example` TEXT column is dropped.
- Same structure and conventions as `word_translations`.
- The application's example enrichment logic (`enrichment.py`) will need to read from this table exclusively.
