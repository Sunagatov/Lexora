# study_queue_items

**Status:** UNCHANGED

Individual items within a smart review queue.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `queue_id` | `INT` | NO | — | FK → `study_queues(id)` |
| `word_id` | `INT` | NO | — | FK → `words(id)` |
| `position` | `INT` | NO | — | Order within the queue |
| `is_completed` | `BOOLEAN` | NO | `false` | Whether this item has been reviewed |
| `completed_at` | `TIMESTAMPTZ` | YES | `NULL` | When the item was completed |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `study_queue_items_pkey` | PRIMARY KEY | `(id)` |
| `fk_sqi_queue` | FOREIGN KEY | `queue_id → study_queues(id) ON DELETE CASCADE` |
| `fk_sqi_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_study_queue_items_queue_id` | `queue_id` | NO | Load items for a queue |
| `ix_study_queue_items_word_id` | `word_id` | NO | Find queues containing a word |

## Relationships

- `queue_id → study_queues(id)` — many items per queue. CASCADE delete.
- `word_id → words(id)` — CASCADE delete (if a word is hard-deleted, its queue items are removed).

## Design Notes

- No changes from the current schema.
- Items are ordered by `position` within a queue.
- `completed_at` is set when `is_completed` transitions to `true`.
