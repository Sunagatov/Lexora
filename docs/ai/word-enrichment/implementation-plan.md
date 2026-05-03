# Implementation Plan

> Phased rollout. Each phase is independently shippable.

## Phase 0 — Fix Quick Add Bug (prerequisite) ✅

- [x] Fix `quickAddWord()` in `frontend/src/features/words/api/wordsApi.ts`
  - Changed `translations: translation` → `translation_entries: [translation]`
  - Also changed signature to accept full payload object
- [x] Verify quick-add works end-to-end (term + translation saved correctly)

---

## Phase 1 — Backend Enrichment Endpoint ✅

### 1a. Free Dictionary API client ✅

- [x] Created `backend/app/features/words/enrich/dictionary_client.py`
  - `async def fetch_dictionary(term: str) -> DictionaryResult | None`
  - Parses: definition, pronunciation_ipa, pronunciation_audio_url, part_of_speech, examples, synonyms, antonyms
  - Returns `None` on 404 or error. Timeout: 5s.

### 1b. Gemini AI client ✅

- [x] Created `backend/app/features/words/enrich/gemini_client.py`
  - `async def fetch_gemini(term: str) -> GeminiResult | None`
  - Uses Gemini REST API with `responseMimeType: "application/json"` for structured output
  - All 17 fields in one call. Timeout: 15s.
- [x] Added `GEMINI_API_KEY` and `GEMINI_MODEL` to `backend/app/shared/config.py`
- [x] Added `GEMINI_API_KEY` and `GEMINI_MODEL` to `.env.example`

### 1c. Merge logic ✅

- [x] Created `backend/app/features/words/enrich/merge.py`
  - DICT preferred for IPA/audio/definition, AI for everything else
  - Validates enums against DB constraints (case-insensitive matching)
  - Deduplicates and caps list sizes

### 1d. Enrichment schemas ✅

- [x] Created `backend/app/features/words/enrich/schemas.py`
  - `EnrichRequest`: term (required), language (default "en")
  - `EnrichResponse`: all 17 enrichable fields

### 1e. Enrichment endpoint ✅

- [x] Created `backend/app/features/words/enrich/router.py`
  - `POST /api/words/enrich` — parallel calls via `asyncio.gather`, graceful degradation, 503 if both fail
- [x] Registered in `main.py` with session + CSRF auth

### 1f. Tests

- [x] Merge logic unit tested (inline, both sources, single source, invalid enums)
- [ ] Formal test files not yet created (test_merge.py, test_dictionary_client.py, etc.)

---

## Phase 2 — Frontend: Enrich Button in Quick Add ✅

- [x] Added `enrichWord(term)` API function in `wordsApi.ts`
- [x] Added `EnrichResult` type in `wordTypes.ts`
- [x] Changed `quickAddWord()` to accept full payload object
- [x] Added enrichment state to `useQuickAdd()`: `enrichResult`, `enrichDone`, `enrich()` action
- [x] `buildSavePayload()` merges all enriched fields into POST /api/words payload
- [x] Updated `QuickAddSheet.tsx`: "✨ Enrich" as primary button, `EnrichPreview` component
- [x] Added enrichment preview CSS
- [x] Updated test assertion for new `quickAddWord` signature

---

## Phase 3 — Frontend: Enrich in Full Edit Form ✅

- [x] Fixed `part_of_speech` select — added "phrasal verb" option
- [x] Fixed `countability` values — lowercase to match DB CHECK constraint
- [x] Fixed `buildSavePayload()` — no longer hardcodes `present_participle: null` / `third_person: null`
- [x] Expanded `EditState` with all missing fields: definition, pronunciation_ipa, cefr_level, register, frequency_rank, present_participle, third_person, synonyms, antonyms, collocations
- [x] Added all missing field inputs to `WordPageEditForm.tsx` with 2-column layout
- [x] Added "✨ Enrich with AI" button — fills only empty fields
- [x] Wired enrichment through `useWordPageState` → `WordPage.tsx` → `WordPageEditForm`

---

## Phase 4 — Cleanup: Remove Old AI Assist ✅

- [x] Removed `translateTerm()`, `suggestTopic()` from `quickAddAssistApi.ts`
- [x] Removed `translateOnly()`, `suggestOnly()`, `autoFill()` from `useQuickAdd.ts`
- [x] Removed "Auto-fill", "Translate", "Suggest topic" buttons from `QuickAddSheet.tsx`
- [x] Kept `ensureInboxTopic()` and `findTopicByName()` (still used by save flow)
- [x] Updated tests to match new hook shape

### Doc simplifications (intentional deviations from original plan)

- **Definition merge**: Plan said "append AI definition as note when DICT has one". Code does simple fallback (`d.definition or a.definition`). Simpler and avoids cluttering the definition field.
- **confusable_entries**: Not added to EditState/edit form. Data is preserved via sparse update (backend only updates fields present in payload). Can be added later if needed.
- **image_url, pronunciation_audio_url**: Not in EditState/edit form. `pronunciation_audio_url` IS saved via Quick Add enrichment. `image_url` has no enrichment source.
- **Backend suggest/service.py**: Not migrated to Gemini — left as-is since it's no longer called from the frontend. Can be removed or migrated later.

---

## Phase 5 — Batch Enrichment (future) ⬜

- [ ] `POST /api/words/enrich/batch` with rate limiting
- [ ] Frontend "Enrich all" button on topic word list

---

## Dependency Graph

```
Phase 0 (bug fix)           ✅
    │
    ▼
Phase 1 (backend endpoint)  ✅
    │
    ├──▶ Phase 2 (quick-add UI)  ✅
    │        │
    │        ▼
    │    Phase 3 (edit form UI)   ✅
    │
    └──▶ Phase 4 (cleanup)       ✅
              │
              ▼
         Phase 5 (batch)          ⬜ future
```
