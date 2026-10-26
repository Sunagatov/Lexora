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
Topic loading failures expose Retry and preserve the requested page. Failed topic
ratings roll back and offer retrying the chosen level. Daily Word Mix disables
every word with a pending rating, even when another word is saved concurrently.
Offline word creation, renaming and topic/identity changes use library-wide
duplicate checks (including Trash); explicit parts of speech stay separate.

The `/` homepage is My Vocabulary: all non-deleted words, server-side sorting
and pagination, default 50 per page, Weak first then A1–C2 within each knowledge
level. Its Strong (level 4) count and knowledge distribution cover the whole
library, independent of search, filters, or the current page. `/smart-review`
remains the separate Daily Word Mix with its session completion progress and
New set action. The logo opens `/` with cleared filters; `/words` retains bulk
editing. Word changes invalidate both the paginated lists and library summary.

Opening a word stores the source list URL and scroll position in router state.
The word's Back action restores that exact list, including search, filters,
sort, page, and page size. Editing/saving and previous/next word navigation keep
this context; direct word links fall back to a current topic or home. List page
clamping waits for words to load so a cold cache cannot erase the saved page.

All word lists share URL-backed filter controls. Knowledge, CEFR, POS, and topics
support multiple selections, with OR within a group and AND between groups.
Topic filtering includes descendants. Primary and secondary sorting are explicit;
the learning preset is Weak first, then A1 first, with alphabetical/ID tie-breaks.
Applied filter chips can be removed individually. Homepage/bulk lists sort and
filter on the server before pagination; topic lists and Daily Word Mix apply the
same rules to their complete local collections. Daily Mix stays within its current
queue and does not generate a new set when changing filters or sort priorities.

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
