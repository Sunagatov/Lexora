# AI Curation Workflow

How to enrich topic words (add examples, create new words) using ChatGPT and the backend REST API.

## Endpoints

| Purpose | Method | Path |
|---|---|---|
| List all topics | GET | `/api/ai-curation/topics` |
| Export topic words (full) | GET | `/api/ai-curation/topics/{topic_id}/export?page=1&page_size=100` |
| Export for ChatGPT (lean) | GET | `/api/ai-curation/topics/{topic_id}/export?lean=true&needs_examples_only=true&page=1&page_size=100` |
| Dry run / live import | POST | `/api/ai-curation/import` |

Auth: session cookie + `X-CSRF-Token` header (same as all protected routes).

## Full workflow

### 1. Export

Call the **lean** export endpoint **against prod** for the target topic. Save the response as `{topic}-page{N}-export.json`.

The lean export (`?lean=true`) returns only `id`, `term`, `example_entries`, and a small example-completeness hint per word — no translations, no topic metadata, no allowed values. Use `needs_examples_only=true` when you want only words that still need enrichment. This is all ChatGPT needs for examples enrichment, and less input means faster responses and fewer hallucinations.

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

## Automated enrichment (no manual copy-paste)

Instead of manually shuttling JSON between the API and ChatGPT, run the enrichment script. It exports all pages automatically, calls the Anthropic API, and imports the results.

```bash
cd backend

# Dry run first — validates everything without writing
PROD_PASSWORD=xxx ANTHROPIC_API_KEY=xxx \
../.venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --dry-run

# Live run — commits to the database
PROD_PASSWORD=xxx ANTHROPIC_API_KEY=xxx \
../.venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live

# Resume from page 4 after a failure
PROD_PASSWORD=xxx ANTHROPIC_API_KEY=xxx \
../.venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live --start-page 4
```

Provider is auto-detected from whichever API key is set. If Claude hits rate limits, switch to OpenAI:

```bash
# OpenAI fallback
PROD_PASSWORD=xxx OPENAI_API_KEY=xxx \
../.venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live --provider openai
```

Default models: `claude-haiku-4-5-20251001` (Anthropic) · `gpt-4o-mini` (OpenAI).
Override with `--model <model-id>`.

## Topic splitting workflow

Use this when a topic is too broad or vague and you want smaller, more specific topic groups.

Current API surface:

| Purpose | Method | Path |
|---|---|---|
| Topic audit | GET | `/api/topics/audit` |
| Dry-run topic split plan | POST | `/api/topics/{topic_id}/split-plan` |
| Enrichment import / live split | POST | `/api/ai-curation/import` |

Practical rule:

- only split topics with more than 300 active words
- keep the original broad topic in place
- create specific topics first
- reassign words into the new topics
- do not remove the umbrella topic automatically
- use dry-run before live import
- reuse an existing active topic if one already matches a candidate bucket closely
- do not create duplicate or near-duplicate topic names
- prefer fewer, broader subtopics instead of many adjacent sibling topics
- if two candidate buckets are too similar, merge them into one clearer bucket
- when in doubt, optimize for clean boundaries over maximum topic count

Suggested split buckets for broad conflict / boundaries topics:

- Safety, Abuse, and Control
- Boundaries, Privacy, and Consent
- Conflict and Repair
- Communication Tools and Scripts
- Emotions, Trust, and Coping
- Relationships and Workplace Situations
- Expectations and Accountability
- Needs and Requests
- Conflict Tactics and Tone
- Reflection and Review

Operational notes from production use:

- The split-plan endpoint is read-only and returns proposed subtopics plus `unassigned_word_ids`.
- If an import hits a backend 500 during repeated DB work, check the prod logs before changing the payload.
- The live import path reuses the existing v2 curation schema, so create topics with `topic_operations` and move words with `word_reassigns`.
- Keep split payloads explainable: one word can belong to more than one topic, but the first pass should prefer a single primary bucket.
- For broad-topic splits, export the full topic page by page from prod first, then build the split plan from the actual prod word IDs.
- For many topics at once, use `backend/app/scripts/split_large_topics.py`. It reads the prod audit, builds per-topic split plans, and writes dry-run import artifacts under `backend/.artifacts/ai-curation/topic-splits/`.

## Service location

`backend/app/features/words/ai_curation/` — router, service, schemas.

Enrichment script: `backend/app/scripts/enrich_examples.py`.

ChatGPT prompt template (manual fallback): `docs/ai/chatgpt-enrich-examples-prompt.txt`.
