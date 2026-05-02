# topics

**Status:** MODIFIED (adds UNIQUE on `name`, CHECK on self-reference)

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `name` | `VARCHAR(200)` | NO | — | Human-readable topic name |
| `slug` | `VARCHAR(200)` | NO | — | URL-safe identifier |
| `description` | `TEXT` | YES | `NULL` | Optional topic description |
| `parent_topic_id` | `INT` | YES | `NULL` | FK → `topics(id)`, one level of nesting |
| `is_active` | `BOOLEAN` | NO | `true` | Soft-active flag |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last modification timestamp |
| `deleted_at` | `TIMESTAMPTZ` | YES | `NULL` | Soft-delete timestamp |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `topics_pkey` | PRIMARY KEY | `(id)` |
| `uq_topics_name` | UNIQUE | `(name)` |
| `uq_topics_slug` | UNIQUE | `(slug)` |
| `fk_topics_parent` | FOREIGN KEY | `parent_topic_id → topics(id) ON DELETE SET NULL` |
| `ck_topics_no_self_ref` | CHECK | `id != parent_topic_id` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_topics_name` | `name` | YES | Implicit from UNIQUE constraint |
| `ix_topics_slug` | `slug` | YES | Implicit from UNIQUE constraint |
| `ix_topics_parent_topic_id` | `parent_topic_id` | NO | FK lookup |
| `ix_topics_deleted_at` | `deleted_at` | NO | Soft-delete filtering |

## Relationships

- Self-referencing: `parent_topic_id → topics(id)` (one level of parent → children).
- Referenced by `word_topics.topic_id` (many-to-many with words).
- Referenced by `words.deleted_via_topic_id` (soft-delete provenance).

## Changes from Current Schema

| Change | Before | After |
|--------|--------|-------|
| `name` uniqueness | Non-unique index | UNIQUE constraint |
| Self-reference guard | None | CHECK `id != parent_topic_id` |

## Design Notes

- `name` is now UNIQUE. The current schema only enforces uniqueness on `slug`. In practice, duplicate topic names with different slugs are a data error.
- One level of nesting (parent → children) is sufficient. No closure table or recursive depth needed.
- `ON DELETE SET NULL` on `parent_topic_id` — deleting a parent topic orphans children rather than cascading deletion.
- Soft-delete via `deleted_at` + `is_active` is preserved from the current design.
