# AI Curation workflow

Manual enrichment of Lexora vocabulary using an external LLM (e.g. ChatGPT).

---

## Endpoints

All endpoints require a valid session cookie + `X-CSRF-Token`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/ai-curation/topics` | List all topics (paginated) |
| `GET` | `/api/ai-curation/topics/{id}/export` | Export one topic's words as structured JSON |
| `POST` | `/api/ai-curation/import` | Apply the LLM's response back to the DB |

Query params for export: `page` (default 1), `page_size` (default 100, max 200).

---

## Typical workflow

1. Call `GET /api/ai-curation/topics` to find the topic ID you want to enrich.
2. Call `GET /api/ai-curation/topics/{id}/export?page_size=200` to get the current word data.
   > The response includes an `exported_at` timestamp. If any word is edited between your export
   > and import, the import is rejected with a clear error. Re-export and retry in that case.
3. Paste the full JSON response into ChatGPT with the prompt below.
4. Copy the model's JSON output.
5. Call `POST /api/ai-curation/import` with `dry_run: true` first to validate.
6. If the dry-run response looks correct, repeat with `dry_run: false`.

---

## ChatGPT prompt template

```
You are enriching an English vocabulary database.

Below is a JSON export of words from the topic "{{TOPIC_NAME}}".
Your job is to return a valid import payload that improves the data quality.

Rules:
- Return ONLY valid JSON. No markdown, no explanation.
- Keep schema_version unchanged ("lexora.ai-curation.v1").
- Keep exported_at unchanged (copy it from the source JSON as-is).
- Existing words keep their id and term.
- You may enrich: translation_entries, example_entries, pattern, countability, part_of_speech, past_simple, past_participle, notes.
- Only include fields you are actually changing. Omit all other fields.
- Use only the allowed countability and part_of_speech values listed in allowed_values.
- Do not invent new topics unless the source topic is genuinely too broad.
- If you create a new topic, reference it by client_key in target_topic_refs / add_topic_refs.
- If splitting a topic, use strict_mode: true and only remove source_topic_id from reassigned words.

Source export:
{{PASTE_EXPORT_JSON_HERE}}
```

---

## Import payload shape

```json
{
  "schema_version": "lexora.ai-curation.v1",
  "source_topic_id": 7,
  "exported_at": "2025-01-15T14:30:00Z",
  "dry_run": true,
  "strict_mode": false,
  "topic_operations": [],
  "word_operations": [...]
}
```

`exported_at` is optional. When present, the server rejects any `update_existing_word` or
`reassign_word_topics` operation for a word that was modified after the export. Omit it to
skip the check (not recommended for production use).

### Word operation types

#### `update_existing_word`

Enriches an existing word. Only include the fields you want to change.
`id` and `term` are required for identity verification; everything else is optional.

```json
{
  "op": "update_existing_word",
  "id": 42,
  "term": "mortgage",
  "translation_entries": ["ипотека", "жилищный кредит"],
  "example_entries": ["They took out a 30-year mortgage."],
  "part_of_speech": "noun",
  "countability": "Countable"
}
```

#### `create_new_word`

Creates a brand-new word and assigns it to one or more topics.
`target_topic_refs` can reference a new topic by `client_key` or an existing topic by `topic_id`.

```json
{
  "op": "create_new_word",
  "target_topic_refs": [{"topic_id": 7}],
  "term": "collateral",
  "translations": "залог",
  "translation_entries": ["залог", "обеспечение"],
  "part_of_speech": "noun",
  "countability": "Uncountable"
}
```

#### `reassign_word_topics`

Moves a word between topics. Typically used when splitting a large topic into narrower ones.

```json
{
  "op": "reassign_word_topics",
  "id": 42,
  "term": "mortgage",
  "add_topic_refs": [{"client_key": "retail-banking"}],
  "remove_topic_ids": [7]
}
```

### Topic operation type

#### `create_topic`

Creates a new topic. `client_key` is a request-scoped identifier used to reference this topic
in word operations within the same request.

```json
{
  "op": "create_topic",
  "client_key": "retail-banking",
  "name": "Retail Banking",
  "description": "Personal banking products",
  "is_active": true
}
```

---

## `dry_run`

When `dry_run: true`, all validation and DB writes run normally but the transaction is rolled
back at the end. The response shows exactly what would have been created/updated/reassigned.
Use this to catch errors before committing.

---

## `strict_mode`

When `strict_mode: true`, `reassign_word_topics` operations are constrained:

- `add_topic_refs` may only reference topics created **in the same request** (via `client_key`).
  References to pre-existing `topic_id` values are rejected.
- `remove_topic_ids` may only contain the `source_topic_id`.
  Removing any other topic is rejected.

Use this when splitting a topic to prevent accidental cross-topic reassignments.

---

## `client_key`

A short string you assign to a `create_topic` operation so you can reference that topic
before it has a real `id`. The key is only meaningful within a single import request.

Example: create topic with `client_key: "retail"`, then reference it in a word operation
with `{"client_key": "retail"}` instead of `{"topic_id": ...}`.

---

## Import response

```json
{
  "source_topic_id": 7,
  "source_topic_name": "Banking",
  "dry_run": false,
  "created_topics": [{"client_key": "retail-banking", "id": 15, "name": "Retail Banking", "slug": "retail-banking"}],
  "created_words": 2,
  "updated_words": 8,
  "reassigned_words": 3,
  "unchanged": 5,
  "created_word_ids": [201, 202],
  "updated_word_ids": [10, 11, 12, 13, 14, 15, 16, 17],
  "reassigned_word_ids": [18, 19, 20]
}
```

---

## Allowed field values

These are validated server-side. Pass only exact strings from these lists.

**countability**: `Countable`, `Uncountable`, `Both`, `Plural`, `Collective`

**part_of_speech**: `noun`, `verb`, `adjective`, `adverb`, `phrase`, `preposition`, `other`

---

## Error handling

| Status | Meaning |
|--------|---------|
| `400` | Payload validation failed (term mismatch, unknown topic ref, strict_mode violation, stale `exported_at`, etc.) |
| `404` | `source_topic_id` does not exist |
| `422` | Pydantic schema error (invalid field values, missing required fields) |

On any error the entire transaction is rolled back — no partial imports.
