# word_progress_events

**Status:** MODIFIED (adds CHECK constraints on `old_level`, `new_level`, `source`)

Append-only log of knowledge level changes for a word.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `word_id` | `INT` | NO | — | FK → `words(id)` |
| `old_level` | `INT` | YES | `NULL` | Previous knowledge level (NULL for first assignment) |
| `new_level` | `INT` | NO | — | New knowledge level |
| `source` | `VARCHAR(32)` | NO | `'manual'` | What triggered the change |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | When the change occurred |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_progress_events_pkey` | PRIMARY KEY | `(id)` |
| `fk_wpe_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `ck_wpe_old_level` | CHECK | `old_level BETWEEN 1 AND 5` |
| `ck_wpe_new_level` | CHECK | `new_level BETWEEN 1 AND 5` |
| `ck_wpe_source` | CHECK | `source IN ('manual', 'study_list', 'smart_review', 'quick_add', 'bulk_import', 'xlsx_import', 'json_import')` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_wpe_word_id` | `word_id` | NO | Find progress history for a word |
| `ix_wpe_created_at` | `created_at` | NO | Time-range queries for stats |

## Relationships

- `word_id → words(id)` — many events per word. CASCADE delete.

## Changes from Current Schema

| Change | Before | After |
|--------|--------|-------|
| `old_level` validation | None | CHECK `BETWEEN 1 AND 5` |
| `new_level` validation | None | CHECK `BETWEEN 1 AND 5` |
| `source` validation | None | CHECK against known values |

## Design Notes

- **Append-only** — events are never updated or deleted (except via CASCADE when the word is hard-deleted).
- **`old_level` is nullable** — the first level assignment for a word has no previous level.
- **CHECK on `source`** — the current schema relies on application-level validation only. The new schema enforces valid sources at the DB level. If new sources are added, the CHECK must be updated via migration.
- **`source` values match `ProgressSource` Literal type** in `backend/app/features/words/constants.py`.
