# AI Curation Workflow

How to enrich topic words (add examples, create new words) using ChatGPT and the backend REST API.

## Endpoints

| Purpose | Method | Path |
|---|---|---|
| List all topics | GET | `/api/ai-curation/topics` |
| Export topic words (full) | GET | `/api/ai-curation/topics/{topic_id}/export?page=1&page_size=100` |
| Export for ChatGPT (lean) | GET | `/api/ai-curation/topics/{topic_id}/export?lean=true&page=1&page_size=100` |
| Dry run / live import | POST | `/api/ai-curation/import` |

Auth: session cookie + `X-CSRF-Token` header (same as all protected routes).

## Full workflow

### 1. Export

Call the **lean** export endpoint **against prod** for the target topic. Save the response as `{topic}-page{N}-export.json`.

The lean export (`?lean=true`) returns only `id`, `term`, and existing `example_entries` per word — no translations, no topic metadata, no allowed values. This is all ChatGPT needs for examples enrichment, and less input means faster responses and fewer hallucinations.

> **Critical:** always export from prod, never from a local database. Word IDs differ between environments — using a local export will cause the import to fail or corrupt wrong words on prod.

To find `topic_id`: `GET /api/ai-curation/topics`.

Auth: you need a valid **prod** session cookie. Log in first:

```bash
curl -s -c cookies.txt -X POST https://lexora.zuf.uk/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"<prod-password>"}' | tee login-response.json
# extract csrf_token from login-response.json
```

### 2. Send to ChatGPT

- Open ChatGPT web interface.
- Attach the export JSON file.
- Paste the prompt from `docs/ai/chatgpt-enrich-examples-prompt.txt` — it contains all rules and the expected return shape. Replace the last line with the actual prod export JSON.

ChatGPT returns a valid import JSON. Save it as `{topic}-page{N}-import.json`.

### 3. Dry run

POST the import JSON as-is (`"dry_run": true`). The backend runs all validation and returns a summary (words updated / created / unchanged) **without writing to the database**.

Check: `updated_words`, `created_words`, `unchanged` counts look correct.

### 4. Live import

Set `"dry_run": false` in the file, POST again. The backend commits the changes.

## What dry_run does

`dry_run: true` runs the full import logic — validates IDs, checks for stale data, resolves topic refs — then calls `db.rollback()` instead of `db.commit()`. Nothing is saved. Safe to run repeatedly.

## Import payload shape (v2)

Three separate arrays replace the old `word_operations` discriminated union.

### Examples-only enrichment (most common)

```json
{
  "schema_version": "lexora.ai-curation.v2",
  "source_topic_id": 6,
  "exported_at": "<copy from export>",
  "dry_run": true,
  "word_updates": [
    {"id": 2662, "example_entries": ["...", "...", "..."]},
    {"id": 2701, "example_entries": ["...", "...", "..."]}
  ]
}
```

`word_updates` is sparse — only include `id` + the fields to change. No `term`, no `op`.

### Adding new words

```json
{
  "schema_version": "lexora.ai-curation.v2",
  "source_topic_id": 6,
  "dry_run": true,
  "word_creates": [
    {
      "target_topic_refs": [{"topic_id": 6}],
      "term": "otter",
      "translations": "выдра",
      "part_of_speech": "noun",
      "countability": "countable",
      "example_entries": ["...", "...", "..."]
    },
    {
      "target_topic_refs": [{"topic_id": 6}],
      "term": "insist",
      "translations": "настаивать",
      "part_of_speech": "verb",
      "pattern": "insist on sth / insist on doing sth",
      "past_simple": "insisted",
      "past_participle": "insisted",
      "example_entries": ["...", "...", "..."]
    }
  ]
}
```

All fields in `word_creates` are optional except `term`, `translations`, and `target_topic_refs`. Include only what applies (e.g. verbs get `past_simple`/`past_participle`/`pattern`; nouns get `countability`).

### Reassigning words to different topics

```json
{
  "word_reassigns": [
    {"id": 2662, "add_topic_refs": [{"topic_id": 7}], "remove_topic_ids": [6]}
  ]
}
```

## Service location

`backend/app/features/words/ai_curation/` — router, service, schemas.

ChatGPT prompt template: `docs/ai/chatgpt-enrich-examples-prompt.txt`.
