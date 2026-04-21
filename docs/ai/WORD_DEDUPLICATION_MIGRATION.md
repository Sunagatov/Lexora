# Word Deduplication & Many-to-Many Topics Migration

**Date:** 2026-04  
**Scope:** Production Supabase database + backend codebase  
**Result:** 1,922 duplicate word rows removed, schema migrated from one-to-many to many-to-many, zero data loss

---

## 1. What Problem We Were Solving

The `words` table had a `topic_id` foreign key — each word belonged to exactly one topic.  
Over time, the same English word (e.g. `"schedule"`, `"lock"`, `"receipt"`) was imported into multiple topics independently, creating duplicate rows with different `topic_id` values.

This caused:
- The same word appearing multiple times in the UI under different topic lists
- Knowledge level updates only affecting one copy — if you studied `"schedule"` in topic A and raised its level to 4, the copy in topic B still showed level 1
- Inflated word counts (10,557 rows for ~8,635 unique words)

**The correct model:** a word is a single entity that can belong to many topics simultaneously. Updating its `knowledge_level` once updates it everywhere.

---

## 2. What We Changed

### 2.1 Database Schema

**Before:**
```
words
  id          PK
  topic_id    FK → topics.id   ← one word, one topic
  term
  knowledge_level
  ...
```

**After:**
```
words
  id          PK
  term
  knowledge_level
  ...                          ← topic_id column removed

word_topics                    ← new join table
  word_id     FK → words.id    (CASCADE DELETE)
  topic_id    FK → topics.id   (CASCADE DELETE)
  PRIMARY KEY (word_id, topic_id)
```

### 2.2 Files Changed

| File | What changed |
|---|---|
| `backend/alembic/versions/20260406_0005_word_many_to_many_topics.py` | New migration: creates `word_topics`, migrates data, drops `topic_id` |
| `backend/app/scripts/deduplicate_words.py` | New one-time script: merges duplicate word rows |
| `backend/app/features/words/model.py` | Removed `topic_id` FK, added `word_topics` association table + M2M relationship |
| `backend/app/features/topics/model.py` | Replaced cascade relationship with M2M back-ref |
| `backend/app/features/words/schemas.py` | `topic_id: int` → `topic_ids: list[int]`; added `WordResponse.from_word()` |
| `backend/app/features/words/repository.py` | All queries use `selectinload(Word.topics)`, M2M create/update |
| `backend/app/features/words/router.py` | All endpoints use `from_word()`, bulk import uses M2M |
| `backend/app/features/topics/repository.py` | `soft_delete` and `restore` guard shared words |
| `backend/app/features/smart_review/schemas.py` | Added `from_item()` and `from_queue()` classmethods |
| `backend/app/features/smart_review/router.py` | `_load_queue()` with full eager loading chain |
| `backend/app/features/smart_review/service.py` | Added `selectinload(Word.topics)` in `_pick_for_level` |
| `backend/app/features/trash/router.py` | Word endpoints now use `from_word()` |
| `backend/alembic/env.py` | Added `connect_args={'prepare_threshold': 0}` for Supabase pooler |

---

## 3. Bugs Found During Code Review (and Why They Kept Appearing)

We did four rounds of review. Each round caught bugs the previous missed because earlier rounds reviewed files in isolation rather than tracing cross-file call chains. The lesson: **always read all related files simultaneously and trace every code path end-to-end before writing anything.**

### Bug 1 — Deduplication script queried a dropped column
**File:** `deduplicate_words.py`  
**What happened:** The script did `SELECT id, term, topic_id FROM words`. But migration 0005 drops `topic_id` from `words`. Running the script after the migration would crash immediately with `column "topic_id" does not exist`.  
**Fix:** Read topic associations from `word_topics` via a `LEFT JOIN` with `array_agg`.

```sql
-- Wrong (after migration topic_id is gone):
SELECT id, term, topic_id FROM words

-- Correct:
SELECT w.id, w.term, w.knowledge_level, w.deleted_at,
  COALESCE(array_agg(wt.topic_id) FILTER (WHERE wt.topic_id IS NOT NULL), '{}') AS topic_ids
FROM words w
LEFT JOIN word_topics wt ON wt.word_id = w.id
GROUP BY w.id
```

### Bug 2 — Wrong canonical selection with soft-deleted words
**File:** `deduplicate_words.py`  
**What happened:** Canonical was chosen by `max(knowledge_level, -id)`. If a soft-deleted word had a higher `knowledge_level` than an active one, it would be picked as canonical — making the word disappear from all topic lists (since `get_all` filters `deleted_at IS NULL`).  
**Fix:** Sort key became `(is_active, knowledge_level, -id)` — active words always win over soft-deleted ones.

### Bug 3 — study_queue_items could get logical duplicates
**File:** `deduplicate_words.py`  
**What happened:** When re-pointing `study_queue_items` from a duplicate `word_id` to the canonical `word_id`, if the canonical was already in the same queue, we'd end up with two items in the same queue pointing to the same word.  
**Fix:** Before updating, check if canonical already exists in that queue. If yes, delete the duplicate item instead of updating it.

### Bug 4 — Trash endpoints crashed on serialization
**File:** `trash/router.py`  
**What happened:** `list_deleted_words` and `restore_word` returned raw ORM `Word` objects. `WordResponse` now requires `topic_ids: list[int]` which comes from the `topics` M2M relationship — Pydantic's `from_attributes=True` cannot traverse a SQLAlchemy M2M relationship to build a `list[int]`. Both endpoints would crash with a Pydantic validation error on every request.  
**Fix:** Both endpoints now call `WordResponse.from_word(w)` explicitly.

### Bug 5 — Smart review serialization crashed (nested word inside queue item)
**File:** `smart_review/schemas.py` + `smart_review/router.py`  
**What happened:** `StudyQueueItemResponse` embedded `word: WordResponse` and relied on `from_attributes=True`. Same problem as Bug 4 — Pydantic can't auto-populate `topic_ids` from a relationship. Both smart review endpoints (`GET /api/smart-review` and `POST /api/smart-review/items/{id}/complete`) would crash on every request.  
**Fix:** Added `StudyQueueItemResponse.from_item()` and `StudyQueueResponse.from_queue()` classmethods. Router uses `_load_queue()` — a single query with `selectinload(items → word → topics)` — then calls `from_queue()`.

### Bug 6 — N+1 queries on word.topics in smart review
**File:** `smart_review/service.py`  
**What happened:** `_pick_for_level` loaded words without `selectinload(Word.topics)`. Accessing `word.topics[0].id` in the loop triggered a separate SQL query per candidate word.  
**Fix:** Added `.options(selectinload(Word.topics))` to the query in `_pick_for_level`.

### Bug 7 — `soft_delete(delete_words=True)` deleted shared words
**File:** `topics/repository.py`  
**What happened:** In the old schema every word belonged to exactly one topic, so `delete_words=True` was safe. After M2M, a word shared across topics A and B would be soft-deleted when topic A is deleted — making it disappear from topic B's list too. The `restore` method already had the correct `len(word.topics) == 1` guard; `soft_delete` was missing it.  
**Fix:** Added the same `len(word.topics) == 1` guard to `soft_delete`.

```python
# Wrong — deletes shared words:
if word.deleted_at is None:
    word.deleted_at = now

# Correct — only deletes exclusively-owned words:
if word.deleted_at is None and len(word.topics) == 1:
    word.deleted_at = now
```

### Bug 8 — Fragile `__dict__` introspection in `WordResponse.from_word`
**File:** `words/schemas.py`  
**What happened:** First version used `word.__dict__` filtering to build the response, which is brittle against SQLAlchemy internal keys and breaks if any column is added or renamed.  
**Fix:** Replaced with explicit field-by-field mapping in `from_word()`.

### Bug 9 — `WordUpdate.topic_ids` allowed empty list
**File:** `words/schemas.py`  
**What happened:** `topic_ids=[]` would silently unlink a word from all topics, making it invisible in every topic list with no error.  
**Fix:** `Field(default=None, min_length=1)` — if provided, must have at least one topic.

### Bug 10 — Hardcoded FK constraint name in migration
**File:** `alembic/versions/20260406_0005_word_many_to_many_topics.py`  
**What happened:** `op.drop_constraint("words_topic_id_fkey", ...)` — this is the default PostgreSQL name but Supabase may auto-generate a different one, causing the migration to fail.  
**Fix:** Wrapped the drop in `op.batch_alter_table("words", recreate="never")` so SQLAlchemy reflects the actual constraint name at runtime.

### Bug 11 — Unused imports
**Files:** `deduplicate_words.py` (imported `delete`, `select`, `update` but only used `text`), `smart_review/service.py` (imported `word_topics` but never used it).  
**Fix:** Removed.

---

## 4. Supabase Connection Issues (and How to Connect for Migrations)

This section is critical for any future migration work against Supabase.

### 4.1 Supabase Has Two Connection Endpoints

| Endpoint | Host | Port | Use for |
|---|---|---|---|
| **Session pooler** | `aws-1-eu-west-2.pooler.supabase.com` | `5432` | App runtime (limited connections) |
| **Transaction pooler** | `aws-1-eu-west-2.pooler.supabase.com` | `6543` | Migrations, scripts |
| **Direct connection** | `db.<project-ref>.supabase.co` | `5432` | Requires IPv6 or paid IPv4 add-on |

**For migrations, always use port `6543` (transaction pooler).**

### 4.2 Problem: Port 5432 — `MaxClientsInSessionMode`

```
FATAL: MaxClientsInSessionMode: max clients reached
```

**Why:** Port 5432 on the pooler host is the *session mode* pooler. It has a hard cap on concurrent connections. When the app is running in production, those slots are taken.  
**Solution:** Use port `6543` instead.

### 4.3 Problem: Direct host `db.<ref>.supabase.co` — DNS not resolving

```
failed to resolve host 'db.fzvwwpzdudxrdzwbucaw.supabase.co'
```

**Why:** Supabase's direct connection hostname is only reachable via IPv6 or with the paid IPv4 add-on enabled. From a standard home/office network it won't resolve.  
**Solution:** Use the transaction pooler on port `6543` instead of the direct host.

### 4.4 Problem: `prepare_threshold` — invalid connection option (psycopg3)

```
psycopg.ProgrammingError: invalid connection option "prepared_statements"
```

**Why:** The Supabase docs show `?prepared_statements=false` in the URL — that's the psycopg2 syntax. This project uses **psycopg3** (`psycopg` package), which uses a different option name.  
Also, passing it as a URL query param sends it as a string, but psycopg3 expects an integer.

**Solution:** Pass via `connect_args` as an integer:
```python
engine = create_engine(url, connect_args={"prepare_threshold": 0})
```

This was added permanently to `alembic/env.py`:
```python
connectable = engine_from_config(
    config.get_section(config.config_ini_section, {}),
    prefix="sqlalchemy.",
    poolclass=pool.NullPool,
    connect_args={"prepare_threshold": 0},  # required for Supabase transaction pooler
)
```

### 4.5 Problem: `DuplicatePreparedStatement` on verification query

```
psycopg.errors.DuplicatePreparedStatement: prepared statement "_pg3_0" already exists
```

**Why:** The transaction pooler reused a backend connection that still had a prepared statement registered from a previous session. This is a known PgBouncer/transaction-mode issue — prepared statements don't survive across pooled connections.  
**This does not mean data was lost.** The deduplication had already committed successfully.  
**Solution:** Use `psql` directly for verification queries instead of SQLAlchemy, or just wait a moment and retry.

### 4.6 How to Run Migrations Against Prod (the correct command)

```bash
cd backend/

POSTGRES_HOST=aws-1-eu-west-2.pooler.supabase.com \
POSTGRES_PORT=6543 \
POSTGRES_DB=postgres \
POSTGRES_USER=postgres.fzvwwpzdudxrdzwbucaw \
POSTGRES_PASSWORD=<password> \
APP_PASSWORD=x SECRET_KEY=x API_KEY=x \
.venv/bin/python -m alembic upgrade head
```

Note: `APP_PASSWORD`, `SECRET_KEY`, `API_KEY` are required by `Settings` validation even for migrations — pass dummy values.

### 4.7 How to Run Scripts Against Prod

```bash
cd backend/

POSTGRES_HOST=aws-1-eu-west-2.pooler.supabase.com \
POSTGRES_PORT=6543 \
POSTGRES_DB=postgres \
POSTGRES_USER=postgres.fzvwwpzdudxrdzwbucaw \
POSTGRES_PASSWORD=<password> \
APP_PASSWORD=x SECRET_KEY=x API_KEY=x \
.venv/bin/python -m app.scripts.deduplicate_words          # dry-run first
.venv/bin/python -m app.scripts.deduplicate_words --apply  # then apply
```

### 4.8 How to Verify DB State Directly

```bash
export PGPASSWORD=<password>
psql "host=aws-1-eu-west-2.pooler.supabase.com port=6543 dbname=postgres \
  user=postgres.fzvwwpzdudxrdzwbucaw sslmode=require" \
  -c "SELECT COUNT(*) FROM words;"
```

---

## 5. Architecture Decisions Made

### 5.1 Why `word_topics` join table instead of keeping `topic_id` on words

Option A (rejected): Keep `topic_id`, allow duplicate word rows, deduplicate at query time.  
Option B (chosen): True M2M — one canonical word row, linked to N topics via `word_topics`.

Reason: Option B means `knowledge_level` is a single source of truth. Updating it once updates it for all topics. Option A would require syncing knowledge levels across duplicates on every update — fragile and error-prone.

### 5.2 Why `WordResponse.from_word()` instead of `from_attributes=True`

Pydantic's `from_attributes=True` works for scalar columns but cannot traverse SQLAlchemy M2M relationships to build a `list[int]`. We need `[t.id for t in word.topics]` which requires the relationship to be loaded.

The pattern established: **every response model that includes relationship data needs an explicit `from_*` classmethod.**

```python
@classmethod
def from_word(cls, word: "Word") -> "WordResponse":
    return cls(
        id=word.id,
        topic_ids=[t.id for t in word.topics],
        # ... all other fields explicitly
    )
```

This also makes the mapping self-documenting and safe against future column additions.

### 5.3 Why `selectinload` everywhere for `Word.topics`

SQLAlchemy lazy-loads relationships by default. After `expire_on_commit=False` (set in `db.py`), relationships are still not loaded unless explicitly requested. Using `selectinload` issues one extra `SELECT ... WHERE word_id IN (...)` query — much better than N individual queries (N+1 problem).

Rule established: **every query that returns `Word` objects must use `selectinload(Word.topics)`.**

The helper in `repository.py`:
```python
def _load_topics(stmt):
    return stmt.options(selectinload(Word.topics))
```

### 5.4 Why `soft_delete` guards shared words

In the old schema, `delete_words=True` on a topic was safe because words were exclusively owned. After M2M, a word shared across topics A and B must not be deleted when only topic A is deleted — it still belongs to topic B.

Rule: **only soft-delete a word if `len(word.topics) == 1`** (it belongs to no other topic).  
Same rule applies to `restore`.

### 5.5 Migration order: migration first, deduplication second

The deduplication script checks for the existence of `word_topics` and refuses to run if it doesn't exist. This enforces the correct order:

1. `alembic upgrade 20260406_0005` — creates `word_topics`, migrates `topic_id` data, drops `topic_id`
2. `deduplicate_words.py` (dry-run) — preview
3. `deduplicate_words.py --apply` — commit

**Never run the deduplication before the migration.**

---

## 6. Key Patterns Established for This Codebase

### Pattern 1: All word-returning endpoints use `from_word()`
```python
# Every endpoint that returns a word:
return WordResponse.from_word(word)
return [WordResponse.from_word(w) for w in words]
```

### Pattern 2: All word queries use `selectinload`
```python
# In repository:
select(Word).options(selectinload(Word.topics)).where(...)
```

### Pattern 3: Smart review queue loading
```python
# In router — always reload with full eager chain before serializing:
def _load_queue(db, queue_id):
    return db.scalar(
        select(StudyQueue)
        .where(StudyQueue.id == queue_id)
        .options(
            selectinload(StudyQueue.items)
            .selectinload(StudyQueueItem.word)
            .selectinload(Word.topics)
        )
    )
```

### Pattern 4: Topic validation before word create/update
```python
# Router validates all topic_ids exist before calling repository:
missing = [tid for tid in payload.topic_ids if topic_repo.get_by_id(db, tid) is None]
if missing:
    raise HTTPException(400, detail=f"Topics not found: {missing}")
```

### Pattern 5: Bulk import skips existing terms (M2M-aware)
```python
existing = {
    _normalize_term(t)
    for t in db.scalars(
        select(Word.term).where(Word.topics.any(Topic.id == topic.id))
    ).all()
}
```

---

## 7. Final DB State After Migration

| Metric | Before | After |
|---|---|---|
| `words` rows | 10,557 | 8,635 |
| `word_topics` rows | 0 (table didn't exist) | 10,557 |
| Duplicate terms | 1,922 | **0** |
| `topic_id` column on `words` | ✅ existed | ❌ dropped |
| Alembic version | `20260406_0004` | `20260406_0005` |

---

## 8. Lessons for Future AI Agent Work on This Codebase

1. **Read all related files simultaneously before writing anything.** Bugs in this migration were consistently caused by reviewing files in isolation. A change in `words/model.py` has ripple effects in `smart_review/schemas.py`, `trash/router.py`, and `topics/repository.py`. Always load the full call chain.

2. **Trace every code path end-to-end.** For each API endpoint: router → repository → model → schema → serialization. Don't stop at the repository layer.

3. **`from_attributes=True` does not work for M2M relationships.** Any `WordResponse` or nested response containing `topic_ids` must go through `from_word()`. If you add a new endpoint that returns words, use `from_word()`.

4. **Always use `selectinload(Word.topics)` when loading words.** Never rely on lazy loading — the session may be closed or the relationship may not be loaded.

5. **Supabase migrations require port 6543 + `connect_args={"prepare_threshold": 0}`.** This is already set in `alembic/env.py`. Do not change it.

6. **The deduplication script is idempotent but one-time.** It checks for `word_topics` existence. Running it again after deduplication will print "Nothing to do." — safe.

7. **`topic_repo.get_by_id` does not filter `deleted_at`.** It uses `db.get()` which bypasses soft-delete. This is intentional for internal lookups but means a soft-deleted topic can be linked to a word via the API. Keep this in mind if adding stricter validation.

8. **`expire_on_commit=False` in `db.py` means in-memory state survives commit.** After `word.topics = [...]` and `db.commit()`, `word.topics` still holds the list you set. `db.refresh(word)` only reloads scalar columns, not relationships. This is why `selectinload` at query time is the only reliable way to get fresh relationship data.

---

## 9. Additional Gotchas Not Covered Above

### 9.1 `alembic.ini` Has a Stale Hardcoded URL — Ignore It

`backend/alembic.ini` contains:
```ini
sqlalchemy.url = postgresql+psycopg://postgres:postgres@localhost:5432/english_learning
```

This is **overridden at runtime** by `alembic/env.py`:
```python
config.set_main_option("sqlalchemy.url", settings.database_url)
```

`settings.database_url` is built from the env vars (`POSTGRES_HOST`, `POSTGRES_PORT`, etc.).  
So the value in `alembic.ini` is never actually used. Do not edit it — just set the correct env vars when running Alembic.

### 9.2 `python` Command Not Found — Use `.venv/bin/python`

On this machine `python` is not on PATH. Always use the virtualenv binary:
```bash
/Users/zufar/PycharmProjects/Lexora/.venv/bin/python
# or from within the backend/ directory:
../.venv/bin/python
```

The venv is at `/Users/zufar/PycharmProjects/Lexora/.venv/` (project root, not inside `backend/`).

### 9.3 `run_migrations_offline()` Does NOT Have `prepare_threshold`

In `alembic/env.py`, the `prepare_threshold: 0` fix was only added to `run_migrations_online()`.  
`run_migrations_offline()` generates SQL without connecting — it doesn't need it.  
But if you ever try to run offline mode against a live Supabase connection, it won't work anyway (offline mode generates SQL to a file, not to the DB). This is not a bug — just be aware of the distinction.

### 9.4 Migration Downgrade Is Best-Effort Only

The `downgrade()` in migration 0005 restores `topic_id` by picking **one arbitrary topic per word**:
```sql
UPDATE words w SET topic_id = (
  SELECT topic_id FROM word_topics wt WHERE wt.word_id = w.id LIMIT 1
)
```

This means after a downgrade, words that were shared across multiple topics will only be linked to one topic — the rest of the M2M links are lost. **Downgrade is a last resort, not a safe rollback.** If you need to roll back, restore from a DB backup instead.

### 9.5 Known Pre-existing Bug in `_pick_for_level_with_fallback`

In `smart_review/service.py`, the fallback call drops the original `excluded_ids`:

```python
def _pick_for_level_with_fallback(..., excluded_ids, ...):
    picked = _pick_for_level(db, level, needed, excluded_ids, topic_counts)
    shortfall = needed - len(picked)
    if shortfall > 0:
        # BUG: passes only {w.id for w in picked}, not excluded_ids | {w.id for w in picked}
        # This means cooldown words and already-selected words from other levels
        # can appear in the fallback pass.
        picked += _pick_for_level(db, level, shortfall, {w.id for w in picked}, topic_counts)
    return picked
```

This was a **pre-existing bug**, not introduced by this migration. We consciously left it unchanged to avoid scope creep. It means in edge cases (very few words at a given level), a word that was in a recent queue could appear again in the fallback. Low impact in practice.

### 9.6 Why `topic_repo.get_by_id` Uses `db.get()` (No `deleted_at` Filter)

```python
def get_by_id(db: Session, topic_id: int) -> Topic | None:
    return db.get(Topic, topic_id)  # ← no deleted_at filter
```

`db.get()` fetches by primary key from the identity map or DB — it does not apply any filters.  
This is **intentional** for internal use: the router uses it to validate that a topic exists before linking a word to it. The side effect is that a soft-deleted topic passes this check and can be linked to a word.

**Practical risk:** If a user soft-deletes a topic and then creates a word with that topic's ID via the API, the word will be linked to a deleted topic and will never appear in any active topic list.

**If you want to fix this** in the future, change `get_by_id` to:
```python
return db.scalar(select(Topic).where(Topic.id == topic_id).where(Topic.deleted_at.is_(None)))
```
But be aware this would also affect `trash/router.py` which calls `get_by_id` to find deleted topics for restore — that would break. So you'd need a separate `get_by_id_including_deleted` method.

### 9.7 `word_topics` Cascade Behaviour Summary

| Action | Effect on `word_topics` |
|---|---|
| Hard-delete a `Word` | All its `word_topics` rows are cascade-deleted |
| Hard-delete a `Topic` | All `word_topics` rows for that topic are cascade-deleted |
| Soft-delete a `Word` | `word_topics` rows are **NOT** touched — the word is just hidden from active queries |
| Soft-delete a `Topic` | `word_topics` rows are **NOT** touched — words still linked, just topic is hidden |
| Restore a `Word` | `word_topics` rows already intact — word reappears in all its topics immediately |

This means soft-delete/restore is fully reversible with no data loss in `word_topics`.

### 9.8 Import Order in `topics/model.py` — Why It Imports from `words/model.py`

```python
# topics/model.py
from app.features.words.model import word_topics
```

`word_topics` is defined in `words/model.py` because `Word` is defined there and the association table must be in the same module as at least one of the models it connects. `Topic` then imports it to declare the back-reference.

This is a **one-directional import** — `words/model.py` does NOT import from `topics/model.py`. The relationship uses the string `"Topic"` for lazy resolution:
```python
# words/model.py
topics = relationship("Topic", secondary=word_topics, back_populates="words")
```

If you ever see a circular import error involving these two models, check that `topics/model.py` imports `word_topics` from `words/model.py` and not the other way around.

---

## 10. Final Gaps — Things Easy to Miss

### 10.1 `bulk_router` Is Intentionally Split from `words_router` in `main.py`

In `main.py`:
```python
app.include_router(bulk_router)                                          # ← NO session auth
app.include_router(words_router, dependencies=[Depends(verify_session)]) # ← session auth
```

`bulk_router` (the `POST /api/words/bulk` endpoint) is registered **without** `verify_session` because it uses `verify_api_key` (an `X-Api-Key` header) instead of a session cookie. This is intentional — bulk import is called by scripts/automation, not by the browser UI.

**Do not add `verify_session` to `bulk_router`** — it would break the import scripts in `maintaner/vocabulary/`.

### 10.2 `bulk_create_words` Silently Skips Soft-Deleted Words

The duplicate check in bulk import:
```python
existing = {
    _normalize_term(t)
    for t in db.scalars(
        select(Word.term).where(Word.topics.any(Topic.id == topic.id))
    ).all()
}
```

This query has **no `deleted_at IS NULL` filter**. If a word was soft-deleted, it still appears in `existing`, and a re-import of that word will be silently skipped with `skipped_terms`.

**Practical consequence:** If you soft-delete a word and then try to re-import it via bulk, it won't come back. You'd need to restore it from trash first, or hard-delete it so the import can recreate it.

This is a pre-existing behaviour, not introduced by this migration. Worth knowing.

### 10.3 `WordResponse` Still Has `from_attributes=True` — It's a Red Herring

```python
class WordResponse(BaseModel):
    ...
    model_config = ConfigDict(from_attributes=True)  # ← this does NOT populate topic_ids
```

`from_attributes=True` is still present but **does not work** for `topic_ids` because that field comes from a M2M relationship, not a scalar column. The only correct way to build a `WordResponse` is via `from_word()`.

The `from_attributes=True` is harmless but could mislead a future developer into thinking `WordResponse.model_validate(word)` works. It doesn't — `topic_ids` would be missing and Pydantic would raise a validation error.

**Rule:** Always use `WordResponse.from_word(word)`. Never use `WordResponse.model_validate(word)` or rely on `from_attributes` for this model.

### 10.4 `TYPE_CHECKING` Import in `schemas.py` — Why and How Not to Break It

```python
# words/schemas.py
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.words.model import Word
```

`Word` is only imported at type-check time (e.g. by mypy/pyright), not at runtime. This avoids a circular import:
- `words/model.py` imports `Base` from `shared/db.py`
- `words/repository.py` imports both `Word` (model) and `WordCreate`/`WordUpdate` (schemas)
- If `schemas.py` imported `Word` at runtime, and `model.py` ever imported from `schemas.py`, you'd get a circular import

The `"Word"` string annotation in `from_word(cls, word: "Word")` is resolved at type-check time only.

**Rule:** If you add any new import to `words/schemas.py` that comes from `words/model.py` or `topics/model.py`, put it under `if TYPE_CHECKING:` — never as a top-level import.

### 10.5 Two Session Patterns — When to Use Which

The codebase has two ways to get a DB session:

**Pattern A — FastAPI dependency injection (all API code):**
```python
# In routers:
def my_endpoint(db: Session = Depends(get_db)):
    ...
```
`get_db()` in `shared/deps.py` yields a session and closes it after the request. Use this for all API endpoints.

**Pattern B — Direct `SessionLocal` context manager (scripts only):**
```python
# In scripts like deduplicate_words.py:
with SessionLocal() as db:
    ...
```
`SessionLocal` is the raw sessionmaker from `shared/db.py`. Use this for standalone scripts that run outside FastAPI. The `with` block handles commit/rollback/close.

**Never use `SessionLocal` directly inside a router or repository** — the session lifecycle won't be managed correctly alongside FastAPI's request lifecycle.

### 10.6 `autoflush=False` — What It Means for Bulk Operations

`db.py` configures:
```python
SessionLocal = sessionmaker(autoflush=False, ...)
```

With `autoflush=False`, SQLAlchemy does **not** automatically flush pending `db.add()` calls before executing a query. This matters in `bulk_create_words`:

```python
for w in payload.words:
    new_word = Word(**w.model_dump(), topics=[topic])
    db.add(new_word)          # ← staged, not yet in DB
    existing.add(...)         # ← in-memory dedup guard
    ...
db.commit()                   # ← all words written at once
```

The in-memory `existing` set is what prevents duplicate terms within the same bulk request — not the DB. If `autoflush` were `True`, each `db.add()` would flush to DB before the next query, which would be slower and unnecessary here.

**Consequence:** If you ever add a query inside the bulk loop (e.g. to check something in the DB), the newly added words won't be visible to that query until after `db.commit()`. Design any such logic to work with the in-memory state instead.

---

## 11. Last Remaining Gaps

### 11.1 `.env` File Location — Why Scripts Must Run from `backend/`

`config.py` loads env files in this order:
```python
model_config = SettingsConfigDict(
    env_file=(".env", "../.env"),  # tries backend/.env first, then project root .env
    ...
)
```

The actual `.env` file lives at the **project root** (`/Lexora/.env`), not inside `backend/`. When you run scripts from `backend/`, `"../.env"` resolves to the project root correctly.

If you run from the project root instead, `".env"` resolves correctly too. But if you run from any other directory, neither path resolves and `Settings` will fail with a validation error on the required fields (`app_password`, `secret_key`, `api_key`).

**Rule: always `cd backend/` before running any Alembic or script command.**

### 11.2 `get_db()` Does Not Rollback on Exception

```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()   # ← no db.rollback() here
```

Unlike the script pattern (`with SessionLocal() as db:` which calls `rollback()` on exception), `get_db()` only closes the session. SQLAlchemy handles the dirty state via connection pool reset, so this is safe in practice — but it means any uncommitted changes from a failed request are silently discarded rather than explicitly rolled back.

This is intentional FastAPI convention. Do not add `db.rollback()` here — it would interfere with FastAPI's exception handling flow.

### 11.3 `purge_expired` — Silent Semantic Change After M2M

In `trash/router.py`:
```python
for topic in topic_repo.get_deleted(db):
    if topic.deleted_at and topic.deleted_at < cutoff:
        topic_repo.hard_delete(db, topic)
```

**Old behaviour (before migration 0005):** Hard-deleting a topic cascade-deleted all its words via the `topic_id` FK `ondelete="CASCADE"`.

**New behaviour (after migration 0005):** Hard-deleting a topic only removes `word_topics` rows for that topic via cascade. The words themselves are **not deleted** — they remain in the `words` table, still linked to any other topics they belong to.

This is the **correct** new behaviour — a shared word should not be deleted just because one of its topics is purged. But it's a silent semantic change: words that were exclusively owned by a purged topic will now become orphans (no `word_topics` rows, invisible in all topic lists, but still in the `words` table).

**If you want to clean up orphaned words**, add this to `purge_expired` or run it manually:
```sql
DELETE FROM words
WHERE deleted_at IS NOT NULL
  AND id NOT IN (SELECT word_id FROM word_topics);
```

### 11.4 `StudyQueueItem.word` Is Untyped — Mypy Blind Spot

```python
class StudyQueueItem(Base):
    ...
    word = relationship("Word")   # ← no Mapped[] annotation
```

All other relationships in the codebase use `Mapped[...]` typed annotations. This one doesn't, which means mypy and pyright won't catch type errors when accessing `item.word` — e.g. `item.word.nonexistent_field` would pass type checking silently.

This is pre-existing and low risk since `_load_queue()` always eagerly loads `word` with `selectinload`. But if you ever refactor `StudyQueueItem`, add the proper annotation:
```python
word: Mapped["Word"] = relationship("Word")
```

### 11.5 Full Migration Chain — Schema History

The complete Alembic migration history for context:

| Revision | What it did |
|---|---|
| `20260406_0001` | Created `topics` and `words` tables. `words.topic_id` FK → `topics.id` (CASCADE). |
| `20260406_0002` | Added `past_simple` and `past_participle` columns to `words`. |
| `20260406_0003` | Created `study_queues` and `study_queue_items` tables for Smart Review. |
| `20260406_0004` | Added `deleted_at` column to both `words` and `topics` (soft-delete support). |
| `20260406_0005` | **This migration.** Created `word_topics` join table, migrated `topic_id` data into it, dropped `topic_id` from `words`. |

### 11.6 `smart_review_size` Config Setting Is Unused

`config.py` defines:
```python
smart_review_size: int = 100
```

This setting is **never referenced** in `smart_review/service.py`. The actual queue size is determined by summing the individual level counts:
```python
level_buckets = {
    1: settings.smart_review_level_1_count,  # default 25
    2: settings.smart_review_level_2_count,  # default 25
    3: settings.smart_review_level_3_count,  # default 25
    4: settings.smart_review_level_4_count,  # default 25
    5: settings.smart_review_level_5_count,  # default 0
}
# total default = 100, matching smart_review_size — but the link is implicit, not enforced
```

`smart_review_size` appears to be a legacy/documentation field. If you change the level counts without updating `smart_review_size`, nothing breaks — but the config becomes misleading. Either wire it up as a cap or remove it in a future cleanup.
