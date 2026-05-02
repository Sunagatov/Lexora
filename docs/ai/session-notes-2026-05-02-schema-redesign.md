# Schema Redesign & Vocabulary Bulk Fill — Session Notes (2026-05-02)

This document captures implementation details, decisions, gotchas, and lessons from the full schema redesign and vocabulary bulk-fill session. Written for future AI agent sessions.

## What Was Done

### 1. Database Schema Redesign

Full schema redesign of the `words` table and related tables. Migration: `20260502_0006_schema_redesign.py`.

**New tables created:**
- `parts_of_speech` — lookup table (8 seed values: noun, verb, adjective, adverb, phrase, preposition, phrasal verb, other)
- `word_verb_forms` — 1:1 with words (past_simple, past_participle, present_participle, third_person)
- `word_synonyms` — 1:N with words (value + optional target_word_id)
- `word_antonyms` — same structure as synonyms
- `word_collocations` — 1:N (value only, no target_word_id)
- `word_confusables` — 1:N (value + target_word_id + explanation)

**New columns on `words`:**
- `language` VARCHAR(2) NOT NULL DEFAULT 'en' — CHECK IN ('en', 'ru')
- `definition` TEXT
- `pronunciation_ipa` VARCHAR(255)
- `pronunciation_audio_url` VARCHAR(512)
- `image_url` VARCHAR(512)
- `part_of_speech_id` INT FK → parts_of_speech(id)
- `cefr_level` VARCHAR(2) — CHECK IN ('A1','A2','B1','B2','C1','C2')
- `register` VARCHAR(20) — CHECK IN ('formal','informal','neutral','slang','technical')
- `frequency_rank` INT — CHECK >= 1

**Dropped columns from `words`:**
- `translations` (flat TEXT) → replaced by `word_translations` entry table
- `example` (flat TEXT) → replaced by `word_examples` entry table
- `past_simple`, `past_participle` → moved to `word_verb_forms`
- `part_of_speech` (free text) → replaced by `part_of_speech_id` FK

**Dropped columns from entry tables:**
- `created_at`, `updated_at` removed from `word_translations` and `word_examples`

**Constraints:**
- `UNIQUE(term, part_of_speech_id, language)` replaces old `uq_words_normalized_term`
- `countability` CHECK uses lowercase values: 'countable', 'uncountable', 'both', 'plural', 'collective'
- `uq_topics_name` was added then dropped — subtopics under different parents can share names (e.g. "Injuries" under both Health and Sports)

### 2. Vocabulary Bulk Fill

4,200 words imported across 7 parent topics × 10 subtopics × 60 words each.

**Parent topics:** Animals (pre-existing), Body & Appearance, Education & Learning, Food & Drink, Health & Medicine, Hobbies & Free Time, Sports & Fitness, Time & Calendar.

**Import method:** ChatGPT generated JSONL files → `import_vocabulary_jsonl.py` script → direct DB access via `bulk_import()`.

**Import script:** `backend/app/scripts/import_vocabulary_jsonl.py` — reads JSONL, groups by `topic_name`, calls `bulk_import()` per topic.

**ChatGPT prompt template:** `docs/ai/chatgpt-word-generation-prompt.md` — reusable for generating more topics.

### 3. Frontend Features Added

- **Filter chips:** POS, CEFR level, completeness (all/complete/incomplete) on word list toolbar
- **Sort options:** CEFR ↑/↓, Newest/Oldest added to existing term/level sorts
- **Word card redesign:** CEFR colored badges, definition preview, richer chips
- **Word detail page redesign:** Sections for definition, IPA, grammar grid, verb forms 2×2, related words, confusables, topic chips
- **All Words page (`/words`):** Global search, server-side pagination, POS/CEFR/level/completeness filters, cross-topic view with topic chips, bulk select with floating action bar
- **Bulk edit:** Select multiple words → batch set knowledge level or add to topic

### 4. Backend API Changes

- `GET /api/words` — added `pos`, `cefr`, `level`, `completeness`, `page`, `page_size` query params. Returns `WordListResponse` with pagination metadata.
- `PATCH /api/words/batch` — bulk update: `{word_ids, knowledge_level?, add_topic_ids?, remove_topic_ids?}`

## Key Architecture Patterns

### POS Resolution (string → FK)
- Pydantic schemas use `part_of_speech: str | None` (the name)
- Repository resolves to `part_of_speech_id` via `_resolve_pos_id(db, name)` which queries `parts_of_speech` table
- `WordResponse.from_word()` reads `word.part_of_speech.name` (the relationship)
- The `part_of_speech` relationship on Word uses `lazy="joined"` for eager loading

### Entry Table Sync
- All entry tables (translations, examples, synonyms, antonyms, collocations, confusables) use position-ordered rows
- Repository `_sync_entry_tables` / `_sync_entry_tables_for_update` handle create/update
- `multivalue.py` is a minimal backward-compat shim used only by `bulk/service.py` and `deduplicate_words.py`

### Filter Architecture
- **Client-side filtering** (StudyPage): `useWordFilter` hook → `filterAndSort()` in `wordDomain.ts` — filters the full word list in memory, URL-synced via search params
- **Server-side filtering** (AllWordsPage): query params sent to `GET /api/words`, server applies filters + pagination
- Both use URL search params for state persistence

### `register` Field Name Conflict
- Pydantic's `BaseModel` has a `.register()` method. Using `register` as a field name triggers a `UserWarning` about shadowing. This is harmless but noisy.
- In `import_operations.py`, accessing `op.register` on a Pydantic model returns the bound method instead of `None` when the field isn't set. Fix: only forward `register` when explicitly in `model_fields_set`.

## Gotchas & Lessons

### Migration Ordering
The migration must normalize existing data BEFORE adding CHECK constraints. The original migration added `ck_words_countability` CHECK before running `UPDATE words SET countability = lower(countability)`, causing the constraint to reject existing uppercase values like "Countable". Fix: move the UPDATE before the `create_check_constraint`.

### Alembic env.py Import
`alembic/env.py` imported `WordProgressEvent` from `app.features.stats.model` but it actually lives in `app.features.words.progress`. Since `Word` model already imports it at the bottom of `model.py`, importing `Word` is sufficient. Fixed by removing the direct import.

### Bulk Import Deduplication Scope
`existing_normalized_terms()` checks ALL words in the entire database, not just the current topic. This means if "fresh" exists in any topic, it's skipped for every subsequent topic import. The word exists but isn't linked to the new topic. Fix: after bulk import, run a re-linking pass that matches JSONL terms to existing words and creates `word_topics` links.

### Topic Name Uniqueness
The migration added `UNIQUE(name)` on topics, but subtopics under different parents legitimately share names (e.g. "Injuries" under both Health & Medicine and Sports & Fitness). The constraint was dropped from the live DB and removed from the migration.

### Frontend Word Type Changes
Updating `wordTypes.ts` is not enough — every component, model, presenter, test, and hook that references Word fields must be updated. The blast radius for the schema redesign was ~21 frontend files. Use `npx tsc --noEmit` to find all breakages.

### Prod Deploy Flow
1. `task -t .../backend/Taskfile.yml prod:ship` — builds, pushes, deploys backend
2. `task -t .../backend/Taskfile.yml prod:migrate` — runs alembic in the container
3. `task -t .../frontend/Taskfile.yml prod:ship` — builds, pushes, deploys frontend
4. The `prod:ship` auto-migrate hook fails with "prod:migrate not found" — run migration manually after deploy

### Importing Data to Prod DB
The import script runs locally but connects to the prod Supabase DB via env vars:
```bash
set -a
source /Users/zufar/IdeaProjects/Vault/apps/lexora/backend/.env.prod
source /Users/zufar/IdeaProjects/Vault/apps/lexora/backend/.env.local-prod-resources
set +a
python3 -m app.scripts.import_vocabulary_jsonl <file.jsonl>
```
Without sourcing both env files, the app falls back to a local SQLite DB (the `database_fallback_activated` message).

### Parent Topic Structure
The bulk import creates flat topics from `topic_name`. Parent topics must be created separately and subtopics re-parented via `UPDATE topics SET parent_topic_id = :pid WHERE name = :name`.

## File Inventory

### Schema Docs
- `docs/ai/schema-redesign/*.md` — 17 files covering all tables, constraints, indexes, relationships

### Migration
- `backend/alembic/versions/20260502_0006_schema_redesign.py`

### Backend (modified)
- `model.py` — PartsOfSpeech, Word (new columns/relationships), WordVerbForm, WordSynonym, WordAntonym, WordCollocation, WordConfusable
- `schemas.py` — WordCreate, WordUpdate, WordResponse, WordInput, WordBulkCreate, WordListResponse, WordBatchUpdate, VerbFormData, ConfusableEntry
- `constants.py` — LANGUAGES, CEFR_LEVELS, REGISTER_VALUES, COUNTABILITY_VALUES, PART_OF_SPEECH_VALUES
- `repository.py` — POS resolution, entry table sync, get_all_words with filters + pagination, batch_update_words
- `repository_queries.py` — search uses definition/pattern/notes, filter by POS/CEFR/level/completeness
- `router.py` — GET /api/words with pagination, PATCH /api/words/batch
- `bulk/service.py` — _build_bulk_word handles all new fields + POS resolution + verb_form
- `api.py` — sync_word_multivalue_fields imported from multivalue shim
- `multivalue.py` — minimal backward-compat shim
- `enrichment.py` — removed flat example fallback
- AI curation (7 files), AI review (3 files), workbook (7 files), stats (1 file) — all updated

### Frontend (modified/created)
- `wordTypes.ts` — Word type with all new fields, VerbForm, ConfusableEntry
- `wordDomain.ts` — SortOption includes cefr-asc/desc/newest/oldest, POS_VALUES, CEFR_LEVELS, CompletenessFilter, FilterOptions
- `wordPresenter.ts` — lexicalChips returns LexicalChip objects with type, CEFR/register chips
- `useWordFilter.ts` — posFilter, cefrFilter, completeness state + URL sync
- `WordCollectionToolbar.tsx` — filter chips panel (POS, CEFR, completeness)
- `WordCollectionView.tsx` — passes new filter props
- `WordSummaryContent.tsx` — CEFR colored badge, definition preview, richer chips
- `WordPageView.tsx` — sectioned layout (definition, IPA, grammar grid, verb forms, related words, confusables, topics)
- `WordDetailPanel.tsx` — CEFR badge in hero, IPA, definition preview
- `AllWordsPage.tsx` — new page at /words with global search, server-side pagination, bulk select
- `wordsApi.ts` — fetchWordList, batchUpdateWords
- `routes.ts` — allWords route
- `router.tsx` — AllWordsPage route
- `AppHeader.tsx` — All Words nav link

### Scripts
- `backend/app/scripts/import_vocabulary_jsonl.py` — JSONL → DB import
- `docs/ai/chatgpt-word-generation-prompt.md` — reusable prompt template

### Vocabulary Data
- `docs/vocabulary/*.jsonl` — 7 files, 600 words each, 4,200 total

## Current Prod State (as of 2026-05-02 23:50 UTC+1)

- **Database:** Supabase PostgreSQL at `aws-1-eu-west-2.pooler.supabase.com:6543`
- **Unique words:** 3,994
- **Word-topic links:** 4,414 (384 words appear in 2+ topics)
- **Topics:** 8 parent topics, 88 subtopics (Animals has 18, rest have 10 each)
- **Migration head:** `20260502_0006`
- **Backend container:** `lexora-backend` on `root@116.203.197.65`
- **Frontend container:** `lexora-frontend` on same server
- **Backend image:** `zufarexplainedit/lexora-backend:latest` (linux/arm64)
- **Frontend image:** `zufarexplainedit/lexora-frontend:latest` (linux/arm64)

## Known Issues / Tech Debt

### Not Yet Fixed
1. **`prod:ship` auto-migrate hook** — fails with "prod:migrate not found in apps/lexora/backend/Taskfile.yml". The task exists but the ship script can't find it. Workaround: run `prod:migrate` manually after deploy.
2. **`register` field UserWarning** — Pydantic warns about `register` shadowing `BaseModel.register()` on every import. Harmless but noisy. Could rename to `formality_register` or suppress the warning.
3. **`useWordFilter.urlSync.test.tsx`** — one pre-existing test failure: `defaultPageSize: 40` not respected in test env because `VITE_PAGE_SIZES` env var isn't set. Not caused by schema redesign.
4. **`quickAddWord` in wordsApi.ts** — still sends `translations` (old flat field) instead of `translation_entries`. Will fail at runtime. Needs updating.
5. **Bulk import deduplication** — `existing_normalized_terms()` is global, not per-topic. Future bulk imports will skip words that exist anywhere. The import script should be enhanced to link existing words to the new topic instead of skipping.
6. **Synonyms/antonyms/collocations/confusables** — schema supports them, tables exist, but all 4,200 imported words have empty arrays. A future ChatGPT enrichment pass could fill these.
7. **`frequency_rank`** — column exists but no data populated. Could be filled from word frequency lists.
8. **`pronunciation_audio_url` and `image_url`** — columns exist but no data. Could be populated from free dictionary APIs.

### Design Decisions Worth Revisiting
1. **Client-side vs server-side filtering** — StudyPage uses client-side (loads all topic words), AllWordsPage uses server-side. If topics grow beyond ~500 words, StudyPage should switch to server-side too.
2. **`parts_of_speech` as a lookup table vs CHECK** — chosen because the set has 8+ values and may grow. Adding a new POS is an INSERT, not a migration.
3. **No `translation_language` column** — translations are implicitly in the "other" language (en→ru, ru→en). If a third language is ever added, this needs rethinking.

## Useful Commands

```bash
# Run backend tests
cd backend && python3 -m pytest --tb=short -q -W ignore::UserWarning

# Check frontend types
cd frontend && npx tsc --noEmit

# Run frontend tests
cd frontend && npx vitest run

# Import vocabulary to prod
cd backend
set -a; source $VAULT/apps/lexora/backend/.env.prod; source $VAULT/apps/lexora/backend/.env.local-prod-resources; set +a
python3 -m app.scripts.import_vocabulary_jsonl ../docs/vocabulary/<file>.jsonl

# Deploy backend
echo "y" | task -t $VAULT/apps/lexora/backend/Taskfile.yml prod:ship
task -t $VAULT/apps/lexora/backend/Taskfile.yml prod:migrate

# Deploy frontend
echo "y" | task -t $VAULT/apps/lexora/frontend/Taskfile.yml prod:ship

# Check prod DB directly
cd backend
set -a; source $VAULT/apps/lexora/backend/.env.prod; source $VAULT/apps/lexora/backend/.env.local-prod-resources; set +a
python3 -c "from app.shared.db import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print(db.execute(text('SELECT count(*) FROM words')).scalar())"

# SSH into prod backend container
cd $VAULT && source scripts/lib/manifest.sh && ssh_exec "docker exec lexora-backend <command>"
```

## ChatGPT Vocabulary Generation

The prompt template at `docs/ai/chatgpt-word-generation-prompt.md` generates 60 words per subtopic in JSONL format. To generate a new topic:

1. Copy the prompt, replace topic name and subtopics table
2. Adjust the "For each subtopic" guidance line for the domain
3. Update example lines to match the domain
4. Ask ChatGPT to provide as a downloadable `.jsonl` file
5. Validate: `python3 -c "import json; [json.loads(l) for l in open('file.jsonl')]"` 
6. Import: `python3 -m app.scripts.import_vocabulary_jsonl file.jsonl`
7. Create parent topic and re-parent subtopics manually (the import creates flat topics)

**Constraint values that ChatGPT must use exactly:**
- `part_of_speech`: noun, verb, adjective, adverb, phrase, preposition, phrasal verb, other
- `countability`: countable, uncountable, both, plural, collective (lowercase!)
- `cefr_level`: A1, A2, B1, B2, C1, C2
- `register`: formal, informal, neutral, slang, technical
- `language`: en, ru
