# study_queues

**Status:** UNCHANGED

Smart review queue sessions. Each queue is a generated set of words for review.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `generated_at` | `TIMESTAMPTZ` | NO | `now()` | When the queue was generated |
| `expires_at` | `TIMESTAMPTZ` | NO | — | When the queue expires |
| `is_active` | `BOOLEAN` | NO | `true` | Whether the queue is currently active |
| `total_count` | `INT` | NO | — | Total number of items in the queue |
| `completed_count` | `INT` | NO | `0` | Number of completed items |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `study_queues_pkey` | PRIMARY KEY | `(id)` |

## Indexes

None beyond the primary key. Queues are accessed by ID or filtered by `is_active`.

## Relationships

- Referenced by `study_queue_items.queue_id` (one queue → many items).

## Design Notes

- No changes from the current schema.
- `is_active` is used to deactivate expired or replaced queues without deleting them.
- `completed_count` is denormalized for quick progress display without counting items.
