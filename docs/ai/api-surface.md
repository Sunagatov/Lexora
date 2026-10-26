# Confirmed API Surface

This is a concise route summary based on inspected routers. Inspect router and schema files before changing request/response contracts.

## Auth And Protection

- Public: `GET /health`, `GET /api/config/public`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`.
- API-key protected: `POST /api/words/bulk` uses `X-Api-Key`.
- Session + CSRF protected: routers mounted in `backend/app/main.py` with `verify_session` and `verify_csrf`.

Protected router groups:

- `/api/topics`
- `/api/words`
- `/api/smart-review`
- `/api/trash`
- `/api/stats`
- `/api/ai-curation`
- `/api/offline`

## Offline Copy And Synchronization

- `GET /api/offline/snapshot` returns version 1 of the complete word/topic copy,
  including Trash, all topic relationships and public retention settings.
- `POST /api/offline/changes` applies one word/topic create, update, soft-delete
  or restore. Requires a UUID operation ID, entity type, action, entity ID,
  data and previous values. Creates use a temporary negative ID; the response
  supplies the real server ID for dependent edits.
- Updates compare previous values for every edited field (and deletion state).
  Deletion/restoration compares the complete item. Topic deletion/restoration
  also checks its affected words, so newer server edits are not silently lost.
  Conflicts return `409` and leave local edits queued. Invalid payloads return `422`.
- Content, learning history and an idempotency receipt commit together. Retrying
  the same UUID and payload returns the original result; reusing the UUID for a
  different payload is rejected. Migration `20261017_0012` adds the receipt table.
  Preserve receipts during image rollback; deleting them loses retry protection.
- Both endpoints keep normal session and CSRF protection. Offline data never
  supplies authentication to the server. A fresh sign-in may be needed to sync.

The frontend's Save offline control beside New topic explicitly saves the complete
copy in IndexedDB. Word/topic CRUD, Trash restoration, filters, pagination and
knowledge ratings use that copy and a durable outbox. Temporary IDs and dependent
topic links are remapped after acknowledged creates. Web Locks serialize writes
across tabs; a BroadcastChannel refreshes other tabs. A failed download/write must
not replace pending edits. Sign-out removes the local copy, with confirmation if
changes are unsynced; offline sign-out also schedules server logout on reconnection.

The service worker caches only the built app shell and static assets, never auth
or API responses. Navigations try the network before the cached shell, preserving
normal release freshness. HTTPS (or localhost), IndexedDB, service workers and
Web Locks are required. Browser storage can be evicted; the offline dialog offers
a JSON backup of the replica and pending operations. It is not an Excel import.

Saving first copies the current Daily Word Mix, including its progress. In saved
mode, New set generates a stable device-local random set of up to 200 active,
non-Parked words; its completion state stays on that device. Word ratings
still sync to the server with normal progress events. AI enrichment, server Excel
import/export, historical stats and permanent Trash purge require internet.
Speech uses the device's installed voices. New app builds cache a versioned shell;
offline use keeps the last downloaded build until an online reload.

On mobile word cards, a deliberate horizontal swipe or primary mouse drag of at least 72px marks
Strong on the right and Parked on the left. Vertical scroll, interactive buttons,
screen-edge navigation and short/cancelled swipes retain their normal behavior.
The card follows the pointer with a Strong/Parked label, then returns to its
position when released. Losing an inner link's implicit touch capture must not
cancel the card's gesture; only loss of the card's own capture does.

Saved copies remain usable when session checks time out or return server errors;
explicit authentication failures still require sign-in. Sync network requests run
outside the local storage lock so browsing and edits stay responsive. Each saved
replica has an optional local revision token: discard a downloaded snapshot if a
tab changed the copy during that download, then sync the newer changes first.
Undo remains available for eight seconds. Visible review pages stay stable after
knowledge changes; sorting/filtering refreshes on the next explicit navigation.

## Auth

- `POST /auth/login` — validates password, sets `session` cookie, returns `csrf_token`.
- `POST /auth/logout` — deletes `session` cookie.
- `GET /auth/session` — validates existing session cookie and returns a CSRF token.

## Health And Public Config

- `GET /health` — service health.
- `GET /api/config/public` — public non-secret config values for frontend use.

## Topics

- `GET /api/topics` — list topics.
- `GET /api/topics/sidebar-stats` — topic sidebar stats.
- `GET /api/topics/audit` — topic refinement/audit summary.
- `GET /api/topics/{topic_id}` — get one topic.
- `POST /api/topics` — create topic.
- `PUT /api/topics/{topic_id}` — update topic.
- `POST /api/topics/{topic_id}/split-plan` — build a read-only topic split plan.
- `DELETE /api/topics/{topic_id}?delete_words={bool}` — soft-delete topic.

Obvious errors from router code include `400` for invalid topic data, `404` for missing topics, and `409` for conflicts such as duplicate names/slugs or active children.

## Words

Knowledge categories are `1` Weak, `3` Okay, `4` Strong and `5` Parked (or null
for unrated). Basic (`2`) is retired. Request payloads, old spreadsheet imports
and scalar/repeated knowledge filters normalize legacy `2` to Okay (`3`). New
exports and UI choices offer only the four categories. Stats retain `level_2: 0`
for compatibility with older clients. The former Basic review quota is added to
Okay, preserving the configured Daily Word Mix size.

Migration `20261017_0011` updates current ratings (including deleted words) and
both level fields in existing progress events. It preserves IDs, timestamps,
sources, topic links and queue completion. A former `2 → 3` event becomes `3 → 3`;
the record remains, but no longer counts as an improvement between categories.
Take a full recoverable database backup before applying: schema downgrade cannot
separate merged ratings. Restore the backup to recover the original distinction.
Deploy backend/migration and frontend together; keep the old image for rollback.

- `GET /api/words` — paginated list with optional `topic_id`, `search`, `pos`, `cefr`, `level`, `completeness`, and `sort` (term/level/CEFR ascending or descending, newest, oldest). Default API sort remains `term-asc`; `level-asc` orders by knowledge, then A1–C2, term, and ID before pagination. Parked/unrated words follow Weak, Okay and Strong. Search includes term, translation, definition, example, pattern, notes, and verb forms.
- `GET /api/words/summary` — whole-library `total` and `level_counts`, excluding deleted words and counting each word once regardless of its topics. Level key `0` represents unrated words.

`GET /api/words` also accepts repeated `levels`, `positions`, `cefr_levels`, and
`topic_ids` parameters. Values within a group are ORed; groups are ANDed.
Selected topics include their active descendants and intersect a scoped
`topic_id` when present. Legacy scalar filters remain supported. `then_sort`
selects a secondary sort using the same values as `sort`, or `none`; alphabetical
term and ID provide stable tie-breaks before pagination. Invalid repeated filter
values or sorting choices return `422`.
Word-list pagination defaults to 50 entries and accepts `page_size` from 1 to 200.
The website offers 50, 100 and 200 entries per page on mobile and desktop.
`include_sequence=true` additionally returns `ordered_ids`: a lightweight snapshot
of every matching Word ID in the same sort order. Main/bulk list navigation keeps
this snapshot across rating changes, so Prev/Next cannot skip unseen words when
live filter membership or sorting changes. Full word content stays paginated.
Saved offline lists provide the same optional field from their local copy.
Word edit forms send only fields changed from their initial draft. Untouched
ratings and content are omitted; no-op saves do not create offline operations.
The editor and local offline changes reject non-integer/non-positive frequency
ranks before queuing an operation. Unknown/deleted topic filters match no local
words, rather than dropping the filter. Quick Add clears AI-filled translations
when the term changes, preserves manual translations, and waits for requested
topic creation before enabling Save or accepting keyboard submission.
- `PATCH /api/words/batch` — atomically changes ratings and/or topic links for
  selected words. Rating changes record normal manual review events; unchanged
  ratings do not add events. Topic IDs must exist outside Trash, and each affected
  word must retain an active topic. Invalid topic changes return `400` before any
  batch changes are saved. The bulk screen preserves selection during rating-only
  updates and prevents overlapping individual/bulk saves for the same word.
- `GET /api/words/export/xlsx` — topic workbook; `layout=flat` exports one row per Word ID.
- `GET /api/words/import/xlsx/template` — blank flat workbook with current topics.
- `POST /api/words/import/xlsx/preview` — multipart `file`, `mode=add|content` (default add), `minimum_translations=0..20` (default four). Returns all issues, counts, before/after entries and a valid batch UUID/hash. Does not change vocabulary.
- `POST /api/words/import/xlsx/apply` — JSON `batch_id`, `plan_hash`; atomically applies the reviewed plan preserving progress. Retries return its receipt; stale/expired previews return 409.
- `GET /api/words/import/xlsx/{batch_id}/recovery` — recovery record for a completed import.
- `POST /api/words/import/xlsx` — deprecated immediate import; returns 409 requiring preview/apply.

Workbook contracts: [bulk-workbook-import.md](bulk-workbook-import.md).
- `GET /api/words/export/ai-review` — export a topic page for AI review.
- `POST /api/words/import/ai-review` — import AI review payload.
- `GET /api/words/{word_id}` — get one word.
- `POST /api/words` — create word.
- `PUT /api/words/{word_id}` — update word.
- `DELETE /api/words/{word_id}` — soft-delete word.
- `POST /api/words/suggest-topic` — suggest a topic via the configured model.
- `POST /api/words/bulk` — bulk create/import words; protected by `X-Api-Key`.

Obvious errors from router code include `400` for invalid input, `404` for missing words/topics, `409` for duplicate word/topic conflicts, and model-related `5xx`/`422` errors for topic suggestion.

## Smart Review

- `GET /api/smart-review` — get or create active queue; returns `503` when disabled.
- `POST /api/smart-review/refresh` — regenerate queue; returns `503` when disabled.
- `POST /api/smart-review/items/{item_id}/complete` — complete queue item.

## AI Curation

All current curation docs should use schema `lexora.ai-curation.v2`.

- `GET /api/ai-curation/topics` — paginated topic list.
- `GET /api/ai-curation/topics/{topic_id}/words` — full paginated word export.
- `GET /api/ai-curation/topics/{topic_id}/export` — full or lean export.
- `POST /api/ai-curation/import` — dry-run or apply v2 curation payload.

Export query params include `lean`, `needs_examples_only`, `page`, and `page_size`.

## Trash

- `GET /api/trash/words` — list deleted words.
- `GET /api/trash/topics` — list deleted topics.
- `POST /api/trash/words/{word_id}/restore` — restore deleted word.
- `POST /api/trash/topics/{topic_id}/restore` — restore deleted topic.
- `DELETE /api/trash/purge?force={bool}` — hard-delete expired trash, or all trash with force.

Topic restoration returns `409` when an active topic already has the same name.
The deleted topic and its words remain in Trash on conflict.

## Stats

- `GET /api/stats` — aggregate stats.
- `POST /api/stats/usage` — record usage event.

Retention `strong_words` counts only Strong (`4`), separately from Okay-or-better.
Topic statistics include all active descendants, deduplicating words linked to
multiple descendants or both a parent and a child, as the sidebar does.
Parking/unparking still records review activity, but does not count as learning
improvement or regression in daily, retention, topic or efficiency metrics.

## Mounted Routers

Confirmed in `backend/app/main.py`:

- `health`
- `auth`
- `words_agent_router`
- `topics`
- `words`
- `words/suggest`
- `smart_review`
- `trash`
- `stats`
- `words/ai_curation`
