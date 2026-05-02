# word_topics

**Status:** UNCHANGED

Many-to-many junction table linking words to topics.

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `word_id` | `INT` | NO | — | FK → `words(id)` |
| `topic_id` | `INT` | NO | — | FK → `topics(id)` |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `word_topics_pkey` | PRIMARY KEY | `(word_id, topic_id)` |
| `fk_word_topics_word` | FOREIGN KEY | `word_id → words(id) ON DELETE CASCADE` |
| `fk_word_topics_topic` | FOREIGN KEY | `topic_id → topics(id) ON DELETE CASCADE` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_word_topics_word_id` | `word_id` | NO | Find topics for a word |
| `ix_word_topics_topic_id` | `topic_id` | NO | Find words in a topic |

## Relationships

- `word_id → words(id)` — CASCADE delete (word deletion removes all topic links).
- `topic_id → topics(id)` — CASCADE delete (topic deletion removes all word links).

## Design Notes

- Composite primary key — no surrogate `id` column needed.
- A word can belong to multiple topics. A topic can contain multiple words.
- Both FKs cascade on delete. This is intentional: when a word or topic is hard-deleted, the junction rows are cleaned up automatically.
- No changes from the current schema.
