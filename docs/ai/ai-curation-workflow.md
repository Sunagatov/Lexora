# AI Curation Workflow

How to enrich topic words (add examples, create new words) using ChatGPT and the backend REST API.

## Endpoints

| Purpose | Method | Path |
|---|---|---|
| List all topics | GET | `/api/ai-curation/topics` |
| Export topic words | GET | `/api/ai-curation/topics/{topic_id}/export?page=1&page_size=100` |
| Dry run / live import | POST | `/api/ai-curation/import` |

Auth: session cookie + `X-CSRF-Token` header (same as all protected routes).

## Full workflow

### 1. Export

Call the export endpoint **against prod** for the target topic. Save the response as `{topic}-page{N}-export.json`.

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
- Paste the prompt from `animals-page1-chatgpt-prompt.txt` (project root) — it already contains all rules and the expected return shape.

ChatGPT returns a valid import JSON. Save it as `{topic}-page{N}-import.json`.

### 3. Dry run

POST the import JSON as-is (`"dry_run": true`). The backend runs all validation and returns a summary (words updated / created / unchanged) **without writing to the database**.

```json
{ "dry_run": true, ... }
```

Check: `updated_words`, `created_words`, `unchanged` counts look correct.

### 4. Live import

Set `"dry_run": false` in the file, POST again. The backend commits the changes.

## What dry_run does

`dry_run: true` runs the full import logic — validates IDs, checks for stale data, resolves topic refs — then calls `db.rollback()` instead of `db.commit()`. Nothing is saved. Safe to run repeatedly.

## Import payload shape (examples-only enrichment)

```json
{
  "schema_version": "lexora.ai-curation.v1",
  "source_topic_id": 6,
  "exported_at": "<copy from export>",
  "dry_run": true,
  "strict_mode": false,
  "topic_operations": [],
  "word_operations": [
    {
      "op": "update_existing_word",
      "id": 2662,
      "term": "alligator",
      "example_entries": ["...", "...", "..."]
    }
  ]
}
```

Supported `op` values: `update_existing_word`, `create_new_word`, `reassign_word_topics`.

## Service location

`backend/app/features/words/ai_curation/` — router, service, schemas.

ChatGPT prompt template: `animals-page1-chatgpt-prompt.txt` (project root).
