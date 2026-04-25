# AI Curation Workflow

This is the canonical current workflow for Lexora AI-assisted vocabulary curation.

Current backend truth:

- schema source: `backend/app/features/words/ai_curation/schemas.py`
- router source: `backend/app/features/words/ai_curation/router.py`
- schema version: `lexora.ai-curation.v2`
- import endpoint: `POST /api/ai-curation/import`
- auth: session cookie + `X-CSRF-Token`

Do not run live export/import scripts unless the user explicitly asks for an operational curation task.

## Endpoints

Protected by session cookie + CSRF:

- `GET /api/ai-curation/topics` — paginated topic list for curation.
- `GET /api/ai-curation/topics/{topic_id}/words` — full paginated word export.
- `GET /api/ai-curation/topics/{topic_id}/export` — full or lean export.
- `POST /api/ai-curation/import` — validates and applies curation payloads.

Useful export query params:

- `lean=true` returns a small examples-focused export.
- `needs_examples_only=true` narrows lean export to incomplete words.
- `page` and `page_size` control pagination.

## Current V2 Import Shape

Use these top-level arrays for all new payloads:

- `topic_operations`
- `word_updates`
- `word_creates`
- `word_reassigns`

The old `word_operations` array is legacy compatibility only. Do not present it as the recommended current payload.

### Examples-Only Enrichment

```json
{
  "schema_version": "lexora.ai-curation.v2",
  "source_topic_id": 6,
  "exported_at": "2026-01-01T12:00:00Z",
  "dry_run": true,
  "word_updates": [
    {
      "id": 2662,
      "example_entries": [
        "She reviewed the contract before signing it.",
        "The new policy will affect every department.",
        "We need a practical solution by Friday."
      ]
    }
  ]
}
```

`word_updates` is sparse. Include `id` and only fields that should change.

### Creating Topics And Words

```json
{
  "schema_version": "lexora.ai-curation.v2",
  "source_topic_id": 6,
  "dry_run": true,
  "topic_operations": [
    {
      "op": "create_topic",
      "client_key": "retail-banking",
      "name": "Retail Banking",
      "description": "Personal banking products",
      "parent_topic_id": 6,
      "is_active": true
    }
  ],
  "word_creates": [
    {
      "target_topic_refs": [{"client_key": "retail-banking"}],
      "term": "collateral",
      "translations": "залог",
      "translation_entries": ["залог", "обеспечение"],
      "part_of_speech": "noun",
      "countability": "Uncountable",
      "example_entries": [
        "The bank asked for collateral before approving the loan.",
        "His car was used as collateral for the debt.",
        "Collateral reduces the lender's risk."
      ]
    }
  ]
}
```

### Reassigning Words

```json
{
  "schema_version": "lexora.ai-curation.v2",
  "source_topic_id": 6,
  "dry_run": true,
  "word_reassigns": [
    {
      "id": 2662,
      "add_topic_refs": [{"topic_id": 7}],
      "remove_topic_ids": [6]
    }
  ]
}
```

## Manual Examples Workflow

1. List topics with `GET /api/ai-curation/topics`.
2. Export a page with `GET /api/ai-curation/topics/{topic_id}/export?lean=true&needs_examples_only=true&page=1&page_size=100`.
3. Use `docs/ai/chatgpt-enrich-examples-prompt.txt` with the exported JSON.
4. Save the model output as a v2 import payload.
5. Submit `dry_run: true`.
6. Review counts and changed IDs.
7. Submit `dry_run: false` only when the user explicitly wants the import applied.

Practical enrichment rules:

- Treat 3 natural English examples as the completion threshold.
- Skip words that already have 3 strong examples.
- Replace examples only when they are weak, repetitive, templated, or unnatural.
- Keep examples practical and vocabulary-app friendly.
- Preserve many-to-many topic membership unless the task is specifically about reassignment.

## Topic Splitting Workflow

Confirmed topic refinement routes:

- `GET /api/topics/audit`
- `POST /api/topics/{topic_id}/split-plan`
- `POST /api/ai-curation/import`

Use splitting only when a topic is broad enough to justify narrower child topics. Prefer fewer, clearer child topics over many similar siblings.

Split import payloads use the same v2 curation schema:

- create child topics with `topic_operations`
- move words with `word_reassigns`
- keep the broad topic in place unless the user explicitly asks otherwise
- use `parent_topic_id` for hierarchy

Review-first guardrails:

- Run dry-run imports before live imports.
- Spot-check 10-15 proposed entries when a plan is large or newly tuned.
- Reuse an existing active topic if it already fits.
- Do not split grammar buckets unless a task explicitly asks for that work.
- Leave fuzzy or overlapping topic families unsplit.

## Automated Script Notes

`backend/app/scripts/enrich_examples.py` can automate export, model calls, and import. It uses operational environment variables documented in `docs/ai/env-reference.md`.

This script talks to a configured API URL and can write data when run with live mode. Do not run it unless explicitly requested.

Related files:

- `docs/ai/chatgpt-enrich-examples-prompt.txt`
- `docs/ai/example-style-guide.md`
- `docs/ai/topic-refinement-prompt.txt`
- `backend/app/scripts/enrich_examples.py`
- `backend/app/scripts/split_large_topics.py`

## Legacy Compatibility

The backend still accepts `word_operations` for backward compatibility and translates legacy operation names into v2 arrays:

- legacy `create_new_word` -> `word_creates`
- legacy `update_existing_word` -> `word_updates`
- legacy `reassign_word_topics` -> `word_reassigns`

This compatibility path is not the current recommended payload shape.
