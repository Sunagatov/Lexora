# Development Workflow

Use the smallest safe local validation that matches the change.

## Backend

From `backend/`:

```bash
python -m pytest
ruff check .
```

For narrow changes, prefer the directly related pytest file first.

Tests force the DB probe to an unused loopback port so collection cannot contact
the configured remote database. Production (`APP_DEBUG=false`) requires Postgres;
SQLite fallback is available only in debug mode. An outdated SQLite schema stops
startup and preserves the file for backup and migration instead of deleting data.

The topic-study client loads every word page before applying its local filters
and pagination. The All Words page continues to use server-side pagination.

All Words uses React Query with filters and pagination in its cache key, so late
responses cannot replace a newer search. Failed loads expose an error and Retry;
failed edits/deletions preserve the word and explain the failure. Enrichment
responses apply only while their original term is still being edited.
Queries retry a failed request at most twice; authentication failures are not retried.

## Frontend

From `frontend/`:

```bash
npm test
npm run lint
npm run build
```

For narrow changes, prefer related Vitest tests first, then build when the change affects app code.

## Docs

For AI documentation architecture changes:

```bash
bash scripts/ai/check-ai-docs.sh
```

Do not run Docker, deployment, SSH, backup, restore, production, or secret commands unless the user explicitly asks for that operational task.
