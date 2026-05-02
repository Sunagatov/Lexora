# app_usage_events

**Status:** UNCHANGED

Tracks frontend usage sessions for activity statistics.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `event_key` | `VARCHAR(64)` | NO | — | Idempotency key (unique per event) |
| `session_key` | `VARCHAR(64)` | NO | — | Groups events within a browser session |
| `route` | `VARCHAR(128)` | YES | `NULL` | Frontend route where activity occurred |
| `active_seconds` | `INT` | NO | — | Seconds of active usage |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | When the event was recorded |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `app_usage_events_pkey` | PRIMARY KEY | `(id)` |
| `uq_app_usage_events_event_key` | UNIQUE | `(event_key)` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `uq_app_usage_events_event_key` | `event_key` | YES | Idempotency |
| `ix_app_usage_events_session_key` | `session_key` | NO | Group by session |
| `ix_app_usage_events_created_at` | `created_at` | NO | Time-range queries |

## Relationships

None. This table is standalone — it doesn't reference words, topics, or queues.

## Design Notes

- No changes from the current schema.
- `event_key` ensures idempotent event recording — the same event sent twice is silently deduplicated.
- `session_key` groups events from the same browser session for streak and consistency calculations.
- No FK to words or topics — usage events track time spent, not specific vocabulary interactions.
