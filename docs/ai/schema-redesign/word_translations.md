# word_translations

**Status:** MODIFIED (adds CHECK constraints on `position` and `value`)

Ordered list of translations for a word. If the word's `language` is `en`, translations are in Russian. If `ru`, translations are in English.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)` |
| `position` | `INT` | NO | — | Display order (0-based) |
| `value` | `TEXT` | NO | — | Translation text |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_translations_pkey` | PRIMARY KEY | `(id)` |
| `fk_word_translations_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `uq_word_translations_word_id_position` | UNIQUE | `(word_id, position)` |
| `ck_word_translations_position` | CHECK | `position >= 0` |
| `ck_word_translations_value` | CHECK | `value != ''` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_translations_word_id` | `word_id` | NO | FK lookup and join performance |

## Relationships

- `word_id → words(id)` — many translations per word. CASCADE delete.

## Changes from Current Schema

| Change | Before | After |
|--------|--------|-------|
| `position` validation | No CHECK | CHECK `position >= 0` |
| `value` validation | No CHECK | CHECK `value != ''` |
| `created_at` | Present | DROPPED — word's own `updated_at` is sufficient |
| `updated_at` | Present | DROPPED — entries are replaced wholesale on edit |

## Design Notes

- **This is now the only source of translations.** The flat `words.translations` TEXT column is dropped. All code that reads/writes translations must use this table.
- **Position is 0-based** — matches the current convention used by the application layer.
- **Empty values are rejected** — the CHECK constraint prevents storing empty-string translations that would be meaningless.
- **No `created_at` / `updated_at`** — entry rows are replaced wholesale on edit, so per-row timestamps are meaningless. The parent word's `updated_at` tracks when translations last changed.
