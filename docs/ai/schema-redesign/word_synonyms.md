# word_synonyms

**Status:** NEW table

Ordered list of synonyms for a word. Each entry stores the synonym text and an optional link to another word in the database.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)`, the word this synonym belongs to |
| `position` | `INT` | NO | — | Display order (0-based) |
| `value` | `TEXT` | NO | — | Synonym text (e.g. "big", "large") |
| `target_word_id` | `INT` | YES | `NULL` | FK → `words(id)`, optional link to the synonym's own word entry |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_synonyms_pkey` | PRIMARY KEY | `(id)` |
| `fk_word_synonyms_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `fk_word_synonyms_target` | FOREIGN KEY | `target_word_id → words(id) ON DELETE SET NULL` |
| `uq_word_synonyms_word_id_position` | UNIQUE | `(word_id, position)` |
| `uq_word_synonyms_word_id_value` | UNIQUE | `(word_id, value)` |
| `ck_word_synonyms_position` | CHECK | `position >= 0` |
| `ck_word_synonyms_value` | CHECK | `value != ''` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_synonyms_word_id` | `word_id` | NO | FK lookup |
| `ix_word_synonyms_target_word_id` | `target_word_id` | NO | Reverse lookup |

## Relationships

- `word_id → words(id)` — many synonyms per word. CASCADE delete.
- `target_word_id → words(id)` — optional link. SET NULL on delete (if the target word is deleted, the synonym text remains).

## Design Notes

- **`value` is always stored** — even when `target_word_id` is set. This ensures the synonym is readable without a join, and survives if the target word is deleted.
- **`target_word_id` is optional** — a synonym might reference a word not yet in the database. The link can be populated later.
- **UNIQUE(word_id, value)** — prevents duplicate synonym entries for the same word.
- **ON DELETE SET NULL for target** — if the linked word is deleted, the synonym text stays but the link is cleared.
- **ON DELETE CASCADE for word_id** — if the owning word is deleted, all its synonyms are deleted.
