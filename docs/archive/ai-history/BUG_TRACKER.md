# Bug Tracker

Tracks every bug found, fixed, or investigated in Lexora — including false positives.
Each entry records what was claimed, what was actually true, why, and what was done.

**Status legend:**
- `FIXED` — confirmed real, code changed
- `FALSE POSITIVE` — investigated, not a real bug
- `KNOWN / DEFERRED` — real issue, consciously left for later
- `PRE-EXISTING` — existed before current work, out of scope

---

## Session: M2M Migration + ChatGPT Review (2026-04)

### Context
Migrated `words.topic_id` (many-to-one) → `word_topics` join table (many-to-many).
Then reviewed ChatGPT's bug report against the actual code.

---

## Backend Bugs

### B-001 — Deduplication script queried dropped column `topic_id`
**Status:** `FIXED`  
**File:** `backend/app/scripts/deduplicate_words.py`  
**What:** Script did `SELECT id, term, topic_id FROM words` but migration 0005 drops `topic_id`.  
**Fix:** Read topic associations from `word_topics` via `LEFT JOIN` + `array_agg`.

---

### B-002 — Wrong canonical selection with soft-deleted words
**Status:** `FIXED`  
**File:** `backend/app/scripts/deduplicate_words.py`  
**What:** Canonical chosen by `max(knowledge_level, -id)`. A soft-deleted word with higher level would be picked, making the word invisible in all topic lists.  
**Fix:** Sort key `(is_active, knowledge_level, -id)` — active words always win.

---

### B-003 — `study_queue_items` could get logical duplicates during deduplication
**Status:** `FIXED`  
**File:** `backend/app/scripts/deduplicate_words.py`  
**What:** Re-pointing a duplicate's queue item to the canonical could create two items with the same `(queue_id, word_id)` if canonical was already in that queue.  
**Fix:** Check first; if canonical already in queue, delete the duplicate item instead of updating it.

---

### B-004 — Trash word endpoints crashed on serialization
**Status:** `FIXED`  
**File:** `backend/app/features/trash/router.py`  
**What:** `list_deleted_words` and `restore_word` returned raw ORM `Word` objects. `WordResponse` now requires `topic_ids: list[int]` from the M2M relationship — Pydantic `from_attributes=True` cannot traverse it.  
**Fix:** Both endpoints now call `WordResponse.from_word(w)` explicitly.

---

### B-005 — Smart review serialization crashed (nested word inside queue item)
**Status:** `FIXED`  
**Files:** `backend/app/features/smart_review/schemas.py`, `smart_review/router.py`  
**What:** `StudyQueueItemResponse` embedded `word: WordResponse` and relied on `from_attributes=True`. Same root cause as B-004.  
**Fix:** Added `from_item()` and `from_queue()` classmethods. Router uses `_load_queue()` with full `selectinload(items → word → topics)` chain.

---

### B-006 — N+1 queries on `word.topics` in smart review service
**Status:** `FIXED`  
**File:** `backend/app/features/smart_review/service.py`  
**What:** `_pick_for_level` loaded words without `selectinload(Word.topics)`. Accessing `word.topics[0].id` in the loop triggered a separate SQL query per candidate word.  
**Fix:** Added `.options(selectinload(Word.topics))` to the query.

---

### B-007 — `soft_delete(delete_words=True)` deleted shared words
**Status:** `FIXED`  
**File:** `backend/app/features/topics/repository.py`  
**What:** After M2M, a word shared across topics A and B would be soft-deleted when only topic A is deleted. The `restore` method already had the `len(word.topics) == 1` guard; `soft_delete` was missing it.  
**Fix:** Added `len(word.topics) == 1` guard to `soft_delete`.

---

### B-008 — Fragile `__dict__` introspection in `WordResponse.from_word`
**Status:** `FIXED`  
**File:** `backend/app/features/words/schemas.py`  
**What:** First version used `word.__dict__` filtering — brittle against SQLAlchemy internal keys and future column additions.  
**Fix:** Replaced with explicit field-by-field mapping.

---

### B-009 — `WordUpdate.topic_ids` allowed empty list
**Status:** `FIXED`  
**File:** `backend/app/features/words/schemas.py`  
**What:** `topic_ids=[]` would silently unlink a word from all topics, making it invisible everywhere with no error.  
**Fix:** `Field(default=None, min_length=1)` — if provided, must have at least one topic.

---

### B-010 — Hardcoded FK constraint name in migration
**Status:** `FIXED`  
**File:** `backend/alembic/versions/20260406_0005_word_many_to_many_topics.py`  
**What:** `op.drop_constraint("words_topic_id_fkey", ...)` — Supabase may auto-generate a different name, causing migration to fail.  
**Fix:** Wrapped in `op.batch_alter_table("words", recreate="never")` so SQLAlchemy reflects the actual name at runtime.

---

### B-011 — Unused imports
**Status:** `FIXED`  
**Files:** `deduplicate_words.py` (imported `delete`, `select`, `update`), `smart_review/service.py` (imported `word_topics`)  
**Fix:** Removed.

---

### B-012 — `_pick_for_level_with_fallback` drops `excluded_ids` on fallback pass
**Status:** `KNOWN / DEFERRED`  
**File:** `backend/app/features/smart_review/service.py`  
**What:** The fallback call passes only `{w.id for w in picked}`, not `excluded_ids | {w.id for w in picked}`. Cooldown words and already-selected words from other levels can appear in the fallback pass.  
**Why deferred:** Pre-existing bug, low impact in practice (only affects edge case where very few words exist at a given level). Left unchanged to avoid scope creep.

---

## Frontend Bugs

### F-001 — `Word` type had `topic_id: number` (singular) — entire frontend broken
**Status:** `FIXED`  
**File:** `frontend/src/shared/http.ts`  
**What:** After M2M migration the backend returns `topic_ids: number[]` but the frontend type still had `topic_id: number`. Every topic word list showed zero words, all topic counts showed 0, `WordPage` crashed or showed wrong data.  
**Fix:** Changed `topic_id: number` → `topic_ids: number[]` in the `Word` type.

---

### F-002 — `topicWords` filter used `w.topic_id === selectedTopicId`
**Status:** `FIXED`  
**File:** `frontend/src/features/study/useStudyState.ts`  
**What:** Direct consequence of F-001. Filter always returned empty array after migration.  
**Fix:** `w.topic_ids.includes(topic.selectedTopicId!)`.

---

### F-003 — `topicCounts` used `w.topic_id`
**Status:** `FIXED`  
**File:** `frontend/src/features/topics/useTopicState.ts`  
**What:** Direct consequence of F-001. All sidebar topic word counts showed 0.  
**Fix:** Iterate `w.topic_ids` and increment count for each topic ID.

---

### F-004 — `WordPage` used `topic_id` throughout (edit, save, delete, prev/next)
**Status:** `FIXED`  
**File:** `frontend/src/features/words/WordPage.tsx`  
**What:** `EditState`, `toEditState`, `save()`, `topicWords` for prev/next, delete navigation, Topic view row — all used `topic_id`.  
**Fix:** All updated to use `topic_ids: string[]`, `topic_ids[0]` for primary topic, `topic_ids.includes()` for filtering.

---

### F-005 — `save()` could send `topic_ids: [0]` to backend
**Status:** `FIXED`  
**File:** `frontend/src/features/words/WordPage.tsx`  
**What:** If topic dropdown had empty selection (`''`), `Number('')` = `0`. Backend `WordUpdate` rejects `0` as invalid topic ID.  
**Fix:** `draft.topic_ids.map(Number).filter((n) => n > 0)` with early return if result is empty.

---

### F-006 — Back-navigation used alphabetically-first topic instead of `topic_ids[0]`
**Status:** `FIXED`  
**File:** `frontend/src/features/words/WordPage.tsx`  
**What:** `topics.find((t) => word?.topic_ids.includes(t.id))` finds whichever topic comes first in the alphabetically-sorted `topics` array — not the word's primary topic.  
**Fix:** `topics.find((t) => t.id === word.topic_ids[0])`.

---

### F-007 — Smart review level badges didn't update optimistically
**Status:** `FIXED`  
**File:** `frontend/src/features/words/useWordUpdate.ts`  
**What:** `useWordUpdate.onMutate` patched `['words']` cache but smart review words come from `queue.items[].word` — a separate cache key `['smart-review']`. Level badge showed old value until next refetch.  
**Fix:** `onMutate` now also patches `['smart-review']` cache in-place by mapping over `items` and updating the matching word's `knowledge_level`.

---

### F-008 — `deleteTopicMutation` didn't invalidate `['words']` cache
**Status:** `FIXED`  
**File:** `frontend/src/features/topics/TopicSidebar.tsx`  
**What:** After deleting a topic (with `delete_words=true`), only `['topics']` was invalidated. The deleted words remained in the `['words']` cache and kept appearing in the word list until page refresh.  
**Fix:** Added `queryClient.invalidateQueries({queryKey: ['words']})` to `onSuccess`.

---

### F-009 — Race condition: `completeSmartReviewItem` response overwrote optimistic level patch
**Status:** `FIXED`  
**File:** `frontend/src/features/smart-review/useSmartReview.ts`  
**What:** `SmartReviewView.handleUpdate` fires both `update.updateLevel()` and `completeItem()` simultaneously. `useWordUpdate.onMutate` optimistically patches the queue with the new level. But `completeSmartReviewItem` fetches a fresh queue from the server — if it resolves before `updateWordKnowledgeLevel`, the server response (with the old level) overwrites the optimistic patch, causing the level badge to flicker back.  
**Fix:** `useSmartReview` mutation now calls `cancelQueries({queryKey: SMART_REVIEW_KEY})` in `onMutate`, preventing the server response from racing against the optimistic update.

---

### F-010 — Topic dropdown in `WordPage` edit form showed wrong topic when `topic_ids` was empty
**Status:** `FIXED`  
**File:** `frontend/src/features/words/WordPage.tsx`  
**What:** `CompactDropdown` falls back to `options[0]` when `value` doesn't match any option. Without an explicit empty option, a word with no topics would silently show the first alphabetical topic in the dropdown — misleading the user.  
**Fix:** Added `{value: '', label: '— select topic —'}` as the first option so the empty state is explicit.

---

## ChatGPT False Positives

These were reported by ChatGPT but are **not real bugs** in the current code.

---

### FP-001 — "Sidebar is doing the wrong job by grouping topics by POS"
**Claimed:** `TopicSidebar.tsx` groups topics under POS labels, mixing navigation and filtering.  
**Reality:** The sidebar correctly separates topics into two collapsible groups: "Parts of Speech" (topics whose names match a fixed set: `adjectives`, `adverbs`, `nouns`, `verbs`, `phrases`, `prepositions`, `irregular verbs`) and "Topics" (everything else). This is an intentional product feature, not a bug. The grouping is by topic name, not by word POS.  
**Verdict:** `FALSE POSITIVE` — product design decision.

---

### FP-002 — "Level-change-under-filter UX looks broken"
**Claimed:** When a level filter is active and a word's level is changed, the word disappears immediately, looking like a save failure.  
**Reality:** The `frozenIds` mechanism in `useWordFilter` handles this correctly. When `useWordUpdate.onMutate` fires, it calls `setFrozenIds` which freezes the current visible word IDs. The changed word stays visible (frozen in place) until the user resets filters. The word only disappears if the user explicitly changes the filter or resets.  
**Verdict:** `FALSE POSITIVE` — already handled by `frozenIds`.

---

### FP-003 — "Bulk import topic matching is not collision-safe"
**Claimed:** Two different topic names that generate the same slug could silently merge.  
**Reality:** The bulk import endpoint checks exact name first (`Topic.name == payload.topic_name`). If the name doesn't match but the slug does, it returns `HTTP 409 Conflict` with a clear error message. Silent merging is not possible.  
**Verdict:** `FALSE POSITIVE` — already handled with 409.

---

### FP-004 — "Mobile search is harder to use than it should be"
**Claimed:** Mobile search is hidden behind a toggle, adding friction.  
**Reality:** This is a UX opinion, not a code bug. The search toggle is intentional to save vertical space on mobile. The desktop always shows the full search input.  
**Verdict:** `FALSE POSITIVE` — UX design choice, not a bug.

---

### FP-005 — "Client-side loading of full vocabulary will become a performance problem"
**Claimed:** `fetchWords()` fetches all words and filters client-side — risky at scale.  
**Reality:** True as an architectural concern, but not a current bug. The app works correctly with the current data size. The `fetchWords` API already supports `topic_id` and `search` query params for server-side filtering when needed.  
**Verdict:** `FALSE POSITIVE` as a bug. Valid as a future architectural concern.

---

### FP-006 — "Add-word feature is missing"
**Claimed:** No manual add-word flow exists in the UI.  
**Reality:** This is a missing feature, not a bug. The backend `POST /api/words` endpoint exists. The UI simply hasn't implemented the add-word form yet.  
**Verdict:** `FALSE POSITIVE` as a bug. Valid as a feature gap.

---

### FP-007 — "Pagination solves the wrong problem"
**Claimed:** Pagination reduces on-screen length but not psychological burden.  
**Reality:** Product opinion, not a code bug.  
**Verdict:** `FALSE POSITIVE` — product design concern.

---

### FP-008 — "Accessibility of custom dropdowns is incomplete"
**Claimed:** `CompactDropdown` likely has incomplete keyboard navigation and screen-reader semantics.  
**Reality:** `CompactDropdown` has `aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-label`, Escape key handling, and pointer-outside-click dismissal. It is reasonably accessible for its scope.  
**Verdict:** `FALSE POSITIVE` — current implementation is adequate. Arrow-key navigation is absent but that is a known limitation, not a regression.

---

## How to Use This File

**For humans:** Before fixing a reported bug, check this file first. If it's listed as `FALSE POSITIVE`, don't waste time on it. If it's `KNOWN / DEFERRED`, check whether the deferral reason still applies.

**For AI agents:** When a bug is reported (by a user, linter, or another AI), search this file by file path or description before investigating. If a matching `FALSE POSITIVE` entry exists, explain why it's not a bug rather than attempting a fix. If a matching `FIXED` entry exists, verify the fix is still in place before re-investigating.

**Adding new entries:** Use the next available ID in sequence (`B-013`, `F-011`, `FP-009`, etc.). Always include: status, file, what the bug was, and what the fix was (or why it's a false positive).
