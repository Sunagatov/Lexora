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
Offline-created words include the false Favorites default. Synchronization also
accepts that default in older queued snapshots while still rejecting newer server
changes. Saved-copy vocabulary summaries use the same filters as their word lists
and include all matching words, independent of pagination.

Settings retain both in-flight and queued changes in the device recovery record
until the server acknowledges them, including nested mix and pronunciation edits.
Daily Word Mix completion claims an item once and increments its count atomically,
so concurrent completions and retries cannot lose or duplicate progress.

The `/` homepage is My Vocabulary: all non-deleted words, server-side sorting
and pagination, default 50 per page, Weak first then A1–C2 within each knowledge
level. Its Strong (level 4) count and knowledge distribution cover all matching
words after search and filters, independent of the current page. Server-paginated
views use the summary response's own total for percentage calculations so separately
loading word pages cannot distort the percentages. Topic lists and Daily Word Mix
summarize their complete filtered collections before pagination. `/smart-review`
remains the separate Daily Word Mix, showing one knowledge bar and a New set
action beside its breadcrumb heading. Session completion is still tracked.
The logo opens `/` with cleared filters; `/words` retains bulk
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

Study ratings count as review activity even when the selected level is unchanged;
manual no-op updates do not. Mobile Daily Mix list swipes also complete unchanged
ratings. Retention coverage counts only current library words, while historical
activity remains available after words enter Trash. Queue statistics accept both
PostgreSQL timestamps and the debug SQLite fallback's naive UTC timestamps.

Word updates, including child-entry-only edits, advance the word modification
time. AI curation checks all exported timestamps before applying any operations,
so one request can update and reassign the same word without conflicting with
itself. Existing words can be reimported without translations in the selected
translation language; new words still require a translation. Both Excel export
layouts preserve text beginning with '=' as literal text. Word-editor enrichment
keeps blank lines between multilingual example blocks, and Trash restoration
checks the exact language/part-of-speech identity, including an unset POS.

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

Pagination resets the owning list container after the requested rows are committed,
including cached pages, page-size and filter changes. Returning from word details
restores the saved position once per navigation, not on background refetches.
Favorites update their heart state immediately, share a per-word pending lock across
visible controls, and roll back only the flag on failure. Taps during a pending save
are ignored; once it finishes, the next tap can reverse the saved state. Captured
card gestures leave the next independent button tap available. Deliberate drags
starting over the card’s heart/speaker actions can rate the word; taps retain their
action, and the knowledge picker/menu remain outside that gesture start area. Daily Mix capture
transfer from a child is not cancellation; cancellation/loss of the active surface's
own pointer still is. English defaults to saved IPA when no notation was selected;
see `easy-pronunciation.md` for coverage diagnostics and safe missing-data follow-up.
