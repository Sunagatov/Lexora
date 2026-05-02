# parts_of_speech

**Status:** NEW table

Lookup table for valid parts of speech. Replaces the free-text `part_of_speech` column on `words`.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `name` | `VARCHAR(50)` | NO | — | Unique POS name, lowercase |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Row creation timestamp |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `parts_of_speech_pkey` | PRIMARY KEY | `(id)` |
| `uq_parts_of_speech_name` | UNIQUE | `(name)` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `uq_parts_of_speech_name` | `name` | YES | Implicit from UNIQUE constraint |

## Seed Data

| id | name |
|---:|------|
| 1 | noun |
| 2 | verb |
| 3 | adjective |
| 4 | adverb |
| 5 | phrase |
| 6 | preposition |
| 7 | phrasal verb |
| 8 | other |

## Relationships

- Referenced by `words.part_of_speech_id` (many words → one POS).

## Design Notes

- A lookup table (not a CHECK constraint) because the POS set already has 7+ values and will grow (conjunction, determiner, interjection, etc.).
- Adding a new POS is an INSERT, not a migration.
- `name` is stored lowercase. Application layer normalizes input before lookup.
- No `updated_at` or soft-delete — these are reference data, not user-managed entities.
