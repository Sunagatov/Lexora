# Backend instructions — Lexora

## Stack

- Python 3.12
- FastAPI
- SQLAlchemy 2
- psycopg 3
- Alembic
- Pydantic 2
- httpx

## Entry points and shared files

Read these first when doing backend work:

- `backend/app/main.py`
- `backend/app/shared/config.py`
- `backend/app/shared/deps.py`

Then read only the target feature folder.

## Confirmed feature groups

- `auth`
- `health`
- `topics`
- `words`
- `smart_review`
- `trash`
- `stats`

## Current architectural pattern

Typical backend flow:

1. router validates HTTP concerns
2. service applies business rules
3. repository/model layer performs DB work
4. schemas shape API payloads

Stay consistent with this pattern unless there is a clear reason not to.

## Auth and request invariants

- Protected API routers use `verify_session` and `verify_csrf`.
- Session auth is cookie-based.
- CSRF token is returned on login and later sent by the frontend as `X-CSRF-Token`.
- Bulk import also uses `X-Api-Key`.

Do not accidentally break this contract.

## Config and env themes

Important settings include:

- Postgres connection values
- session cookie settings
- secret key / app password / API key
- smart review tuning
- CORS origins
- model provider settings for topic suggestion
- Alembic startup behavior and DB lock timeouts

## AI suggestion path

The current suggestion flow:

- reads all active topics from DB
- builds a topic list prompt
- sends a chat completion request
- expects the model to return exactly one existing topic name

This is the highest-value place to reduce model cost and latency.

When changing this flow:

- keep deterministic fallbacks first
- reduce prompt size aggressively
- reduce output tokens aggressively
- cache repeated lookups
- prefer returning stable IDs internally over large textual payloads
- add observability for latency, cache hit rate, and invalid model responses
- if Alembic startup fails with a prepared-statement collision, check the shared engine settings and disable prepared statements for the migration path as needed

## AI curation and topic splitting

For topic enrichment and split work, read `docs/ai/ai-curation-workflow.md` and `docs/ai/topic-refinement-prompt.txt` first.

Durable rules:

- export from prod only; do not use local DB exports for prod imports because IDs differ
- treat 3 good example sentences per word as the completion threshold
- use lean exports and `needs_examples_only=true` when you only need unfinished words
- when splitting broad topics, prefer clear subtopics with obvious boundaries
- split only topics with more than 300 active words
- skip part-of-speech umbrella topics for now
- keep the broad topic as an umbrella unless the split is genuinely clean
- create new topics first, then reassign words; do not delete the umbrella automatically
- reuse an existing topic if it already fits closely enough
- avoid duplicate or near-duplicate topic names
- prefer fewer, broader subtopics over many very similar siblings
- if a split would make two confusing topics, merge them back into one clearer bucket
- use review-first dry runs before any live import
- for broad topic families, keep umbrella topics and attach subtopics under them instead of replacing the parent topic
- subtopics are ordinary topic rows with `parent_topic_id`; do not invent a parallel topic system
- when a word belongs to more than one topic, keep that many-to-many structure intact instead of forcing a single membership

## Validation

Use the smallest useful validation first:

```bash
cd backend
python -m pytest
ruff check .
```

If a task only touches one feature, prefer tests for that feature instead of a broad scan.
