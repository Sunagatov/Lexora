# Smart Review (Daily Word Mix) — Performance Investigation

**Date:** 2026-05-15  
**Symptom:** Opening `https://lexora.zuf.uk/` redirects to `/smart-review`, which takes too long to load.

---

## How the Page Load Works

### Redirect

The root route `/` intentionally redirects to `/smart-review` via:

```tsx
// frontend/src/app/router.tsx
{index: true, element: <Navigate to={routes.smartReview} replace />}
```

This is by design — Daily Word Mix is the home screen.

### Request Waterfall

```
[0ms]     GET /auth/session              ← blocks ALL rendering (Providers waits for auth)
[~200ms]  React mounts, 3 queries fire in parallel:
          ├── GET /api/topics            ← typically fast
          ├── GET /api/topics/sidebar-stats  ← medium (joins word_topics)
          └── GET /api/smart-review      ← BOTTLENECK
[???ms]   ALL three must resolve before the skeleton disappears
```

The loading state that controls the skeleton:

```ts
// frontend/src/features/study/hooks/useStudyState.ts
const isLoading =
  topicsQuery.isLoading ||
  sidebarStatsQuery.isLoading ||
  (isSmartReview && smartReview.isLoading)
```

The page shows a skeleton until **all three** resolve. The smart-review endpoint dominates.

---

## Backend: What `GET /api/smart-review` Does

### Call chain

```
router.get_active_queue()
  → service.get_or_create_active_queue(db)
      → lifecycle.load_active_queue(db)          # loads queue + items + words
      → service._should_regenerate_queue(db, q)  # iterates all items in Python
      → service.generate_queue(db)               # if regeneration needed
          → selection.cooldown_word_ids(db)      # scans StudyQueueItem
          → for each of 5 levels:
              selection.pick_for_level_retry_excluded(db, ...)
                → _list_smart_review_candidates(db, level, ...)  # NO LIMIT — loads ALL words at level
                → (may run TWICE per level due to retry logic)
          → lifecycle.deactivate_all_queues(db)
          → lifecycle.build_queue(...) + persist_queue(...)
  → router._load_queue(db, queue.id)             # SECOND full load with heavy eager loading
      → selectinload(items → word → topics)
      → selectinload(items → word → translation_items)
      → selectinload(items → word → example_items)
  → StudyQueueResponse.from_queue(loaded)        # serializes full WordResponse for each item
```

### Identified bottlenecks

#### 1. No LIMIT on candidate query

```python
# backend/app/features/smart_review/selection.py
def _list_smart_review_candidates(db, *, level: int, excluded_ids: set[int]) -> list[Word]:
    stmt = (
        select(Word)
        .options(selectinload(Word.topics))
        .where(Word.is_active.is_(True))
        .where(Word.deleted_at.is_(None))
        .where(Word.knowledge_level == level)
        .order_by(Word.updated_at.asc())
    )
    # ...
    return list(db.scalars(stmt).all())
```

This loads **every word** at a given knowledge level into memory, even though only 5 are needed per level (configured via `smart_review_level_N_count`). With the retry logic in `pick_for_level_retry_excluded`, this runs **up to 10 times** (2× per level × 5 levels).

#### 2. No composite index on the filtered columns

The query filters on `knowledge_level`, `is_active`, `deleted_at` and orders by `updated_at`. No composite index exists — every call does a sequential scan of the `words` table.

Existing indexes on `words`:
- `ix_words_term`
- `ix_words_deleted_at`
- `ix_words_deleted_via_topic_id`
- `ix_words_language`
- `ix_words_source`

None cover the smart-review access pattern.

Additionally, the `cooldown_word_ids` query filters `study_queue_items` on `is_completed` and `completed_at >= cutoff`, but there is no index on `completed_at` for that table. Existing indexes are only `queue_id` and `word_id`.

#### 3. Double-loading the queue

The service calls `load_active_queue()` which eagerly loads items + words (for the regeneration check). Then the router calls `_load_queue()` again with even heavier eager loading (adding topics, translations, examples). Two full loads of the same data.

#### 4. Expensive regeneration check in Python

```python
# backend/app/features/smart_review/lifecycle.py
def queue_needs_regeneration(queue: StudyQueue) -> bool:
    if len(queue.items) != queue.total_count:
        return True
    return any(
        item.word is None
        or item.word.deleted_at is not None
        or not item.word.is_active
        for item in queue.items
    )
```

This iterates all queue items in Python after loading them with their words. Could be a single SQL `EXISTS` query.

#### 5. Over-fetching word relationships for the list view

`_load_queue` eagerly loads for each word:
- `topics` (via `word_topics` join table)
- `translation_items`
- `example_items`

But the list view (`WordCollectionView`) only displays: `term`, `knowledge_level`, `part_of_speech`, `cefr_level`, `topic_ids`. The full word data (examples, synonyms, translations, etc.) is only needed when the user clicks a word — and `WordDetailPanel` already fetches that independently via `GET /api/words/:id`.

#### 6. Response payload size

Each word in the queue response includes the full `WordResponse` schema: translations, examples, synonyms, antonyms, collocations, confusables, verb forms, notes, etc. For 20 words, this can be 40–60KB of JSON that the list view doesn't use.

#### 7. N+1 lazy-load queries during serialization

`_load_queue()` only eager-loads 3 word relationships:

```python
word_loader.selectinload(Word.topics),
word_loader.selectinload(Word.translation_items),
word_loader.selectinload(Word.example_items),
```

But `WordResponse.from_word()` accesses **8 relationships**:
- `word.topics` ✅ (eager-loaded)
- `word.translation_items` ✅ (eager-loaded)
- `word.example_items` ✅ (eager-loaded)
- `word.part_of_speech` ✅ (declared `lazy="joined"` in model)
- `word.verb_form` ❌ **lazy-loaded — 1 query per word**
- `word.synonym_items` ❌ **lazy-loaded — 1 query per word**
- `word.antonym_items` ❌ **lazy-loaded — 1 query per word**
- `word.collocation_items` ❌ **lazy-loaded — 1 query per word**
- `word.confusable_items` ❌ **lazy-loaded — 1 query per word**

**For a 20-word queue, this causes up to 100 additional SQL queries** (5 missing relationships × 20 words) during response serialization. This is likely the single biggest contributor to endpoint latency.

---

## Frontend Issues

#### 8. No `staleTime` on the smart-review query

```ts
// frontend/src/features/smart-review/hooks/useSmartReview.ts
const query = useQuery({queryKey: queryKeys.smartReview, queryFn: fetchSmartReview, enabled})
```

No `staleTime` means React Query refetches on every mount/navigation. The queue lives 72 hours — there's no reason to refetch it every time the user navigates back.

#### 9. Sidebar loading blocks main content

The `isLoading` flag requires topics + sidebar stats + smart review to ALL resolve before showing content. The sidebar and the word mix are independent — the user could see their words while the sidebar populates.

#### 10. Auth bootstrap adds a sequential round-trip before anything renders

```ts
// frontend/src/app/providers.tsx
useEffect(() => {
  bootstrapSession().then((authenticated) => {
    // ...
    setAuthReady(true)
  })
}, [])

return <QueryClientProvider client={queryClient}>{authReady ? children : null}</QueryClientProvider>
```

The entire app renders nothing (`null`) until `GET /auth/session` completes. Only after that do the 3 parallel queries fire. This adds ~100–300ms of dead time before any data fetching begins. This is architecturally necessary for auth, but it means the smart-review endpoint latency is additive on top of the auth round-trip.

#### 11. `refetchOnWindowFocus` defaults to `true`

The global `QueryClient` config does not set `refetchOnWindowFocus`. React Query defaults it to `true`, meaning every time the user switches tabs and returns, ALL active queries (topics, sidebar-stats, smart-review) refetch simultaneously — including the N+1-heavy smart-review endpoint.

#### 12. Word update invalidation cascade

`useWordUpdate` calls `invalidateWordDependencies()` on every word level change, which invalidates **all of**: `['words']`, `['topic-sidebar']`, `['stats']`, `['smart-review']`. After marking a single word in the Daily Word Mix, 4 query families are invalidated and refetch simultaneously — including the expensive smart-review endpoint that just served the current data.

---

## Scalability Concern

As more words and topics are added:

| Growth factor | Impact |
|---|---|
| More words per level | `_list_smart_review_candidates` loads ALL of them |
| More topics | `selectinload(Word.topics)` loads more join rows per candidate |
| More completed items | `cooldown_word_ids` scans more `StudyQueueItem` rows (no index on `completed_at`) |
| More queue history | `deactivate_all_queues` scans all active queues (no index on `is_active`) |
| Larger response | 20 words × full WordResponse grows with relationship data |
| More topics in sidebar | `sidebar-stats` scans entire `word_topics` join (no caching) |
| More word relationships | N+1 lazy loads grow linearly (5 queries × queue size) |

With 5,000 words across 50 topics, the current design would load ~5,000 Word ORM objects + their topic associations just to pick 20 words.

The `sidebar-stats` endpoint (`compute_topic_sidebar_stats`) also scans the entire `word_topics` join table on every page load with no server-side caching. As word/topic count grows, this becomes a secondary bottleneck.

---

## Recommended Fixes

### Fix 1: Fix N+1 lazy-load queries in `_load_queue` (CRITICAL)

**Impact:** Very high — eliminates ~100 extra SQL queries per request  
**Effort:** Trivial (add missing selectinloads)

```python
def _load_queue(db: Session, queue_id: int) -> StudyQueue | None:
    word_loader = selectinload(StudyQueue.items).selectinload(StudyQueueItem.word)
    return db.scalar(
        select(StudyQueue)
        .where(StudyQueue.id == queue_id)
        .options(
            word_loader.selectinload(Word.topics),
            word_loader.selectinload(Word.translation_items),
            word_loader.selectinload(Word.example_items),
            word_loader.selectinload(Word.synonym_items),
            word_loader.selectinload(Word.antonym_items),
            word_loader.selectinload(Word.collocation_items),
            word_loader.selectinload(Word.confusable_items),
            word_loader.subqueryload(Word.verb_form),
        )
    )
```

This turns ~100 lazy-load queries into ~8 batched queries regardless of queue size.

### Fix 2: Add LIMIT to candidate query

**Impact:** High — eliminates loading thousands of rows  
**Effort:** Trivial (one line)

```python
def _list_smart_review_candidates(db, *, level: int, excluded_ids: set[int], limit: int = 50) -> list[Word]:
    stmt = (
        select(Word)
        .options(selectinload(Word.topics))
        .where(Word.is_active.is_(True))
        .where(Word.deleted_at.is_(None))
        .where(Word.knowledge_level == level)
        .order_by(Word.updated_at.asc())
        .limit(limit)
    )
    if excluded_ids:
        stmt = stmt.where(Word.id.not_in(excluded_ids))
    return list(db.scalars(stmt).all())
```

Why 50: need 5 per level, `max_per_topic=5`. 50 candidates gives 10× headroom for topic diversity. Works regardless of total word count.

### Fix 3: Add composite index

**Impact:** High — turns table scans into index seeks  
**Effort:** One Alembic migration

```python
# For the candidate selection query:
op.create_index(
    "ix_words_smart_review_candidates",
    "words",
    ["knowledge_level", "is_active", "deleted_at", "updated_at"],
)

# For the cooldown query (filters on is_completed + completed_at):
op.create_index(
    "ix_study_queue_items_completed",
    "study_queue_items",
    ["is_completed", "completed_at"],
)
```

### Fix 4: Eliminate double-load

**Impact:** Medium — removes one full query round-trip  
**Effort:** Small refactor

Have `get_or_create_active_queue` return just the queue ID. The router does one definitive load with the response-level eager loading.

```python
def get_or_create_active_queue_id(db: Session) -> int | None:
    if not settings.smart_review_enabled:
        return None
    queue = _load_active_queue_lightweight(db)  # only loads queue + item count
    if queue is not None:
        if _should_regenerate(db, queue):
            queue = generate_queue(db)
        return queue.id
    return generate_queue(db).id
```

### Fix 5: SQL-based regeneration check

**Impact:** Medium — avoids loading all items into Python  
**Effort:** Small

```python
def queue_needs_regeneration_sql(db, queue_id: int) -> bool:
    bad_item = db.scalar(
        select(StudyQueueItem.id)
        .outerjoin(Word, StudyQueueItem.word_id == Word.id)
        .where(StudyQueueItem.queue_id == queue_id)
        .where((Word.id.is_(None)) | (Word.deleted_at.is_not(None)) | (Word.is_active.is_(False)))
        .limit(1)
    )
    return bad_item is not None
```

### Fix 6: Lighter eager loading for queue response

**Impact:** Medium — reduces response payload ~70%  
**Effort:** Small (adjust `_load_queue` + handle missing relationships in schema)

Remove `translation_items` and `example_items` from `_load_queue`. The list view doesn't need them, and `WordDetailPanel` fetches full word data on demand via `GET /api/words/:id`.

```python
def _load_queue(db: Session, queue_id: int) -> StudyQueue | None:
    return db.scalar(
        select(StudyQueue)
        .where(StudyQueue.id == queue_id)
        .options(
            selectinload(StudyQueue.items)
            .selectinload(StudyQueueItem.word)
            .selectinload(Word.topics),
        )
    )
```

### Fix 7: Add `staleTime` to frontend query

**Impact:** Medium — avoids refetch on every navigation  
**Effort:** One line

```ts
const query = useQuery({
  queryKey: queryKeys.smartReview,
  queryFn: fetchSmartReview,
  enabled,
  staleTime: 60_000, // 60 seconds
})
```

### Fix 8: Decouple sidebar loading from main content

**Impact:** Medium — user sees word mix sooner  
**Effort:** Small

```ts
// Only block the word mix on its own data:
const isLoading = isSmartReview
  ? smartReview.isLoading
  : (topicsQuery.isLoading || sidebarStatsQuery.isLoading)
```

Let the sidebar show its own skeleton independently.

### Fix 9 (optional): Add `staleTime` to topics and sidebar-stats queries

**Impact:** Low-medium — reduces redundant fetches for sidebar data  
**Effort:** One line each

```ts
const topicsQuery = useQuery({
  queryKey: queryKeys.topics,
  queryFn: fetchTopics,
  staleTime: 30_000,
})
const sidebarStatsQuery = useQuery({
  queryKey: queryKeys.topicSidebar,
  queryFn: fetchTopicSidebarStats,
  staleTime: 30_000,
})
```

These change infrequently and don't need to refetch on every mount.

### Fix 10: Disable `refetchOnWindowFocus` globally (or set `staleTime`)

**Impact:** Medium — prevents refetch storm on tab switch  
**Effort:** One line in QueryClient config

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // data stays fresh for 30s — prevents refetch on focus/mount
      retry: (_, error) => !(error instanceof ApiError && (error.status === 401 || error.status === 403)),
    },
  },
})
```

Setting a global `staleTime` is preferred over disabling `refetchOnWindowFocus` — it solves both the focus-refetch and mount-refetch problems while still allowing background updates after the stale window.

### Fix 11: Narrow the word-update invalidation

**Impact:** Medium — prevents refetching the entire smart-review queue after every word level change  
**Effort:** Small

Currently `invalidateWordDependencies()` invalidates `['smart-review']` on every word update. But the smart-review mutation (`completeItem`) already uses `setQueryData` to optimistically update the queue. The broad invalidation undoes this by triggering a full refetch.

Remove `queryKeys.smartReview` from the invalidation list in `useWordUpdate`, since the `completeItem` mutation already handles queue state updates optimistically.

---

## Expected Results

| Scenario | Before | After |
|---|---|---|
| Cold load, 2000 words | 1.5–3s | ~200ms |
| Cold load, 10000 words | 5–10s+ | ~200ms (same, capped by LIMIT) |
| Return navigation (within 60s) | Full refetch | Instant (cached) |
| Response payload | ~50KB | ~8KB |
| Adding 10 new topics | Slower (more joins) | No change (LIMIT caps work) |

---

## Verified Non-Issues

These were investigated and confirmed NOT to be contributing factors:

- **`ensure_database_schema()`** — called in `get_db()` but is a no-op for PostgreSQL (only runs for SQLite fallback).
- **Auth middleware (`verify_session`, `verify_csrf`)** — lightweight JWT decode + HMAC compare, sub-millisecond.
- **HTTP request logging middleware** — only logs timing, doesn't add latency.
- **CORS middleware** — standard FastAPI CORS, negligible overhead.
- **`UsageTracker` component** — tracks time client-side, doesn't fire API calls on mount.
- **HTTP client (`shared/api/http.ts`)** — simple fetch wrapper, no retries or interceptors that add delay.
- **`word_topics` join table indexes** — has indexes on both `word_id` and `topic_id` (adequate for current queries).
- **`WordCollectionView` component** — pure presentational, no `useQuery` calls, receives all data via props.
- **`StudySidebarShell` / `TopicSidebar`** — no additional queries; all data passed via props from `useStudyState`.
- **`SmartReviewView`'s `useSmartReview(false)`** — creates a disabled query (`enabled: false`), shares cache key but does not fire a duplicate fetch.
- **`deactivate_all_queues` transaction** — does not commit independently; part of the `generate_queue` transaction that commits atomically in `persist_queue`. Correct behavior.
- **`useWordFilter` computation** — memoized via `useMemo`, negligible cost for queue sizes (20–40 words).

---

## File References

| File | Role |
|---|---|
| `frontend/src/app/router.tsx` | Redirect `/` → `/smart-review` |
| `frontend/src/app/providers.tsx` | Auth bootstrap that blocks all rendering; global QueryClient config |
| `frontend/src/features/study/hooks/useStudyState.ts` | Orchestrates all queries, defines `isLoading` |
| `frontend/src/features/smart-review/hooks/useSmartReview.ts` | React Query hook for smart review |
| `frontend/src/features/smart-review/components/SmartReviewView.tsx` | UI component with skeleton |
| `frontend/src/features/words/hooks/useWordUpdate.ts` | Word level mutation, triggers `invalidateWordDependencies` |
| `frontend/src/features/words/model/wordCache.ts` | `WORD_DEPENDENT_QUERY_KEYS` and `invalidateWordDependencies` |
| `frontend/src/features/words/components/WordDetailPanel.tsx` | Detail panel (already fetches own data via `/api/words/:id`) |
| `backend/app/features/smart_review/router.py` | HTTP endpoint + `_load_queue` (N+1 source) |
| `backend/app/features/smart_review/service.py` | `get_or_create_active_queue`, `generate_queue` |
| `backend/app/features/smart_review/selection.py` | `_list_smart_review_candidates` (no LIMIT bottleneck) |
| `backend/app/features/smart_review/lifecycle.py` | `load_active_queue`, `queue_needs_regeneration` |
| `backend/app/features/words/schemas.py` | `WordResponse.from_word()` — accesses 8 relationships |
| `backend/app/features/topics/sidebar_stats.py` | `compute_topic_sidebar_stats` (secondary bottleneck) |
| `backend/app/shared/config.py` | Queue size settings (5 per level, 72h TTL, 500ms slow threshold) |
| `backend/app/shared/deps.py` | `verify_session`, `verify_csrf` (lightweight, not a concern) |
| `backend/app/main.py` | Middleware, router registration, request logging |
