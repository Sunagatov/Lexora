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

## Validation

Use the smallest useful validation first:

```bash
cd backend
python -m pytest
ruff check .
```

If a task only touches one feature, prefer tests for that feature instead of a broad scan.
