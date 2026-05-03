# Current State Audit

> Scanned: 2026-05-03 · Source: backend/app/features/
>
> ⚠️ The sections below describe the **pre-implementation** state. See [Post-Implementation Status](#post-implementation-status) at the bottom for what's been fixed.

## All Database Tables (15 total)

| # | Table | Model Class | Location |
|---|-------|-------------|----------|
| 1 | `words` | `Word` | `words/model.py` |
| 2 | `word_topics` | *(association table)* | `words/model.py` |
| 3 | `parts_of_speech` | `PartsOfSpeech` | `words/model.py` |
| 4 | `word_translations` | `WordTranslation` | `words/model.py` |
| 5 | `word_examples` | `WordExample` | `words/model.py` |
| 6 | `word_verb_forms` | `WordVerbForm` | `words/model.py` |
| 7 | `word_synonyms` | `WordSynonym` | `words/model.py` |
| 8 | `word_antonyms` | `WordAntonym` | `words/model.py` |
| 9 | `word_collocations` | `WordCollocation` | `words/model.py` |
| 10 | `word_confusables` | `WordConfusable` | `words/model.py` |
| 11 | `word_progress_events` | `WordProgressEvent` | `words/progress.py` |
| 12 | `topics` | `Topic` | `topics/model.py` |
| 13 | `study_queues` | `StudyQueue` | `smart_review/model.py` |
| 14 | `study_queue_items` | `StudyQueueItem` | `smart_review/model.py` |
| 15 | `app_usage_events` | `AppUsageEvent` | `stats/model.py` |

## Word Table — All Columns

| Column | Type | Constraints | Auto-filled on add? |
|--------|------|-------------|---------------------|
| `id` | int PK | auto-increment | ✅ auto |
| `term` | varchar(255) | NOT NULL, indexed | ✅ user input |
| `language` | varchar(2) | CHECK: en/ru, default 'en' | ✅ default |
| `definition` | text | nullable | ❌ |
| `pronunciation_ipa` | varchar(255) | nullable | ❌ |
| `pronunciation_audio_url` | varchar(512) | nullable | ❌ |
| `image_url` | varchar(512) | nullable | ❌ |
| `part_of_speech_id` | FK → parts_of_speech | nullable | ❌ |
| `cefr_level` | varchar(2) | CHECK: A1/A2/B1/B2/C1/C2 | ❌ |
| `register` | varchar(20) | CHECK: formal/informal/neutral/slang/technical | ❌ |
| `countability` | varchar(20) | CHECK: countable/uncountable/both/plural/collective | ❌ |
| `frequency_rank` | int | CHECK: ≥ 1 | ❌ |
| `knowledge_level` | int | CHECK: 1–5 | ✅ defaults to 1 |
| `pattern` | text | nullable | ❌ |
| `notes` | text | nullable | ❌ |
| `is_active` | bool | default true | ✅ default |
| `created_at` | timestamptz | server default now() | ✅ auto |
| `updated_at` | timestamptz | server default now(), auto-update | ✅ auto |
| `deleted_at` | timestamptz | nullable (soft delete) | — |
| `deleted_via_topic_id` | FK → topics | nullable | — |

Unique constraint: `(term, part_of_speech_id, language)`

## Word Entry Tables

| Table | Columns | Unique constraints |
|-------|---------|-------------------|
| `word_translations` | `id`, `word_id` (FK CASCADE), `position` (≥0), `value` (text, non-empty) | (word_id, position) only — no value uniqueness |
| `word_examples` | `id`, `word_id` (FK CASCADE), `position` (≥0), `value` (text, non-empty) | (word_id, position) only — no value uniqueness |
| `word_synonyms` | `id`, `word_id` (FK CASCADE), `position` (≥0), `value` (text, non-empty), `target_word_id` (FK SET NULL, optional) | (word_id, position), (word_id, value) |
| `word_antonyms` | `id`, `word_id` (FK CASCADE), `position` (≥0), `value` (text, non-empty), `target_word_id` (FK SET NULL, optional) | (word_id, position), (word_id, value) |
| `word_collocations` | `id`, `word_id` (FK CASCADE), `position` (≥0), `value` (text, non-empty) | (word_id, position), (word_id, value) |
| `word_confusables` | `id`, `word_id` (FK CASCADE), `position` (≥0), `value` (text, non-empty), `target_word_id` (FK SET NULL, optional), `explanation` (text, nullable) | (word_id, position), (word_id, value) |
| `word_verb_forms` | `word_id` (PK, FK CASCADE), `past_simple` (varchar 255), `past_participle`, `present_participle`, `third_person` | — |

## Topic Table — All Columns

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | int PK | auto-increment |
| `name` | varchar(200) | indexed |
| `slug` | varchar(200) | unique |
| `description` | text | nullable |
| `parent_topic_id` | FK → topics (self) | nullable, SET NULL on delete — supports hierarchy |
| `is_active` | bool | default true |
| `created_at` | timestamptz | server default now() |
| `updated_at` | timestamptz | server default now(), auto-update |
| `deleted_at` | timestamptz | nullable (soft delete) |

## Parts of Speech — Reference Table

| Column | Type |
|--------|------|
| `id` | int PK |
| `name` | varchar(50), unique |

Seed values: `noun`, `verb`, `adjective`, `adverb`, `phrase`, `preposition`, `phrasal verb`, `other`

## Pydantic Schemas (DTOs)

| Schema | File | Purpose |
|--------|------|---------|
| `WordCreate` | `words/schemas.py` | POST /api/words — `topic_ids` required (min 1), `term` required, all else optional, `extra="forbid"` |
| `WordUpdate` | `words/schemas.py` | PUT /api/words/{id} — all optional, sparse update via `model_fields_set`, `extra="forbid"` |
| `WordResponse` | `words/schemas.py` | Response — all fields + computed: `example_count`, `example_target_count` (3), `example_status`, `needs_example_enrichment` |
| `WordBulkCreate` | `words/schemas.py` | Bulk import — `topic_name` + list of `WordInput` (max 500) |
| `VerbFormData` | `words/schemas.py` | Nested: `past_simple`, `past_participle`, `present_participle`, `third_person` |
| `ConfusableEntry` | `words/schemas.py` | Nested: `value` (required), `explanation` (optional) |
| `TopicCreate` | `topics/schemas.py` | POST /api/topics — `name` required, `description`, `parent_topic_id`, `is_active` |
| `TopicUpdate` | `topics/schemas.py` | PUT /api/topics/{id} — all optional, `extra="forbid"` |
| `TopicResponse` | `topics/schemas.py` | Response — all fields including `parent_topic_id` |
| `SuggestTopicRequest` | `words/suggest/schemas.py` | POST /api/words/suggest-topic — `term`, `translation` |
| `AiReviewImportWord` | `words/ai_review/schemas.py` | AI review import — all enrichable fields |
| `WordCreateV2` / `WordUpdateV2` | `words/ai_curation/import_schemas.py` | AI curation import — all enrichable fields |

## Constants

```
WORD_TERM_MAX_LEN = 255
KNOWLEDGE_LEVEL_MIN = 1, KNOWLEDGE_LEVEL_MAX = 5
LANGUAGES = ("en", "ru")
CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
REGISTER_VALUES = ("formal", "informal", "neutral", "slang", "technical")
COUNTABILITY_VALUES = ("countable", "uncountable", "both", "plural", "collective")
PART_OF_SPEECH_VALUES = ("noun", "verb", "adjective", "adverb", "phrase", "preposition", "phrasal verb", "other")
```

## Current External Integrations

### 1. MyMemory Translation (frontend-side)

- **File**: `frontend/src/features/words/api/quickAddAssistApi.ts` → `translateTerm()`
- **URL**: `https://api.mymemory.translated.net/get?q={term}&langpair=en|ru`
- **Direction**: English → Russian only
- **No API key**, free tier
- **Quality**: mediocre — literal/mechanical translations, no context

### 2. OpenAI-compatible Topic Suggestion (backend-side)

- **File**: `backend/app/features/words/suggest/service.py` → `suggest_topic_for_word()`
- **Endpoint**: `POST {OPENAI_BASE_URL}/chat/completions`
- **Default**: GitHub Models (`https://models.inference.ai.azure.com`), model `gpt-4o-mini`
- **Auth**: Bearer token via `OPENAI_API_KEY`
- **Behavior**: picks best matching topic from existing topic list
- **Returns 503** if `OPENAI_API_KEY` is not configured

### 3. AI Curation — Export/Import (manual copy-paste workflow)

- **Routes**: `GET/POST /api/ai-curation/*`
- **Schema**: `lexora.ai-curation.v2`
- **Not automated** — user exports JSON, pastes into ChatGPT, imports result back

### 4. AI Review — Export/Import (manual copy-paste workflow)

- **Routes**: `GET /api/words/export/ai-review`, `POST /api/words/import/ai-review`
- **Schema**: `lexora.ai-review.v1`
- **Not automated** — same manual workflow as curation

### 5. Enrichment Script (offline tool)

- **File**: `backend/app/scripts/enrich_examples.py`
- **Supports**: Gemini, OpenAI, Anthropic via env vars
- **Not part of the web app** — CLI-only batch tool

## Frontend Architecture (Word Feature)

> All paths relative to `frontend/src/features/words/`

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `QuickAddSheet` | `components/QuickAddSheet.tsx` | Bottom sheet for adding a new word. Renders as portal to `document.body`. Fields: term input, translation input, topic select. Buttons: "✨ Auto-fill AI", "Translate", "Suggest topic", "Save word". Also used from `StudyPage.tsx` via FAB. |
| `WordPageEditForm` | `components/WordPageEditForm.tsx` | Full edit form for existing words. Fields: term, translations (textarea), knowledge_level, part_of_speech, topics (multi-select checkboxes), countability (noun only), past_simple/past_participle (verb only), examples (textarea), notes, pattern. |
| `WordPageView` | `components/WordPageView.tsx` | Read-only view of a single word |
| `WordPageChrome` | `components/WordPageChrome.tsx` | Layout wrapper for word page (view + edit) |
| `WordDetailPanel` | `components/WordDetailPanel.tsx` | Detail panel in word list views |
| `WordCollectionView` | `components/WordCollectionView.tsx` | Word list with table/card views |
| `WordCollectionToolbar` | `components/WordCollectionToolbar.tsx` | Toolbar with filters and actions |
| `WordTable` | `components/WordTable.tsx` | Table view of words |
| `WordCardList` | `components/WordCardList.tsx` | Card view of words |
| `WordSummaryContent` | `components/WordSummaryContent.tsx` | Summary content for word cards |
| `WordPagination` | `components/WordPagination.tsx` | Pagination controls |
| `LevelDropdown` | `components/LevelDropdown.tsx` | Knowledge level selector |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useQuickAdd` | `hooks/useQuickAdd.ts` | All quick-add state and logic: term/translation/topic state, AI assist (translate, suggest, autofill), save mutation, topic creation. Returns `canSave`, `save()`, `translateOnly()`, `suggestOnly()`, `autoFill()`. |
| `useWordPageState` | `hooks/useWordPageState.ts` | Single word page state: fetches word/topics, manages edit draft (`EditState`), save/delete mutations, prev/next navigation within topic. |
| `useWordUpdate` | `hooks/useWordUpdate.ts` | Optimistic knowledge_level update with rollback. |
| `useWordFilter` | `hooks/useWordFilter.ts` | URL-synced filters: search, level, pos, cefr, completeness, sort, page, pageSize. |

### Model Layer

| Module | File | Purpose |
|--------|------|---------|
| `wordForm` | `model/wordForm.ts` | `EditState` type (term, translations, knowledge_level, part_of_speech, topic_ids, countability, past_simple, past_participle, example, notes, pattern). `toEditState(word)` and `buildSavePayload(draft, isVerb, isNoun)` — splits textarea by newlines, sends `translation_entries` (list) and `example_entries` (list). |
| `wordDomain` | `model/wordDomain.ts` | Constants: `POS_VALUES` (8 values including `phrasal verb`), `CEFR_LEVELS`, sort options, level labels. Filter/sort logic. |
| `wordCache` | `model/wordCache.ts` | React Query cache helpers: optimistic updates, invalidation of `[words, topicSidebar, stats, smartReview]`. |
| `wordPresenter` | `model/wordPresenter.ts` | Display helpers: `lexicalChips(word)` for POS/CEFR/countability/register badges, `smartPreview(word)` for verb forms/pattern/notes. |
| `wordPageContext` | `model/wordPageContext.ts` | Topic resolution for word navigation. |

### API Layer

| Function | File | Method | Endpoint | Notes |
|----------|------|--------|----------|-------|
| `quickAddWord(term, translation, topicIds)` | `api/wordsApi.ts` | POST | `/api/words` | ⚠️ Sends `{translations: translation}` — wrong field name (see bugs) |
| `fetchWords(params)` | `api/wordsApi.ts` | GET | `/api/words` | Hardcoded `page_size=100`, returns `Word[]` |
| `fetchWordList(params)` | `api/wordsApi.ts` | GET | `/api/words` | Full pagination support, returns `WordListResponse` |
| `fetchWord(id)` | `api/wordsApi.ts` | GET | `/api/words/:id` | Single word |
| `updateWord(id, payload)` | `api/wordsApi.ts` | PUT | `/api/words/:id` | Used by edit form via `buildSavePayload()` |
| `deleteWord(id)` | `api/wordsApi.ts` | DELETE | `/api/words/:id` | — |
| `updateWordKnowledgeLevel(id, level, source)` | `api/wordsApi.ts` | PUT | `/api/words/:id` | Sends `{knowledge_level, progress_source}` |
| `batchUpdateWords(payload)` | `api/wordsApi.ts` | PATCH | `/api/words/batch` | Bulk level/topic changes |
| `exportWordsWorkbook()` | `api/wordsApi.ts` | GET | `/api/words/export/xlsx` | Browser download |
| `importWordsWorkbook(file)` | `api/wordsApi.ts` | POST | `/api/words/import/xlsx` | FormData upload |
| `translateTerm(term)` | `api/quickAddAssistApi.ts` | GET | MyMemory external API | `langpair=en\|ru`, frontend-side, no backend |
| `suggestTopic(term, translation)` | `api/quickAddAssistApi.ts` | POST | `/api/words/suggest-topic` | Backend AI call |
| `ensureInboxTopic(topics, onCreated)` | `api/quickAddAssistApi.ts` | — | Creates "Inbox" topic if missing | — |
| `findTopicByName(topics, name)` | `api/quickAddAssistApi.ts` | — | Case-insensitive local lookup | — |

### Types

| Type | File | Key fields |
|------|------|------------|
| `Word` | `types/wordTypes.ts` | All 30+ fields matching `WordResponse` from backend. Includes `translation_entries: string[]`, `example_entries: string[]`, `synonym_entries: string[]`, `antonym_entries: string[]`, `collocation_entries: string[]`, `confusable_entries: ConfusableEntry[]`, `verb_form: VerbForm \| null`. |
| `VerbForm` | `types/wordTypes.ts` | `past_simple`, `past_participle`, `present_participle`, `third_person` (all `string \| null`) |
| `ConfusableEntry` | `types/wordTypes.ts` | `value: string`, `explanation: string \| null` |
| `WordKnowledgeLevel` | `types/wordTypes.ts` | `1 \| 2 \| 3 \| 4 \| 5` |
| `EditState` | `model/wordForm.ts` | `term`, `translations`, `knowledge_level`, `part_of_speech`, `topic_ids: string[]`, `countability`, `past_simple`, `past_participle`, `example`, `notes`, `pattern` |

### Quick Add Flow (end-to-end)

1. User opens QuickAddSheet (from topic page FAB or study page FAB)
2. `useQuickAdd()` hook initializes, auto-selects Inbox topic if none selected
3. User types term in "Word or phrase" input
4. User clicks one of:
   - **"✨ Auto-fill AI"** → `autoFill()` → calls `translateTerm(term)` (MyMemory, frontend-side) → if translation found, calls `suggestTopic(term, translation)` (backend AI) → sets translation + topic
   - **"Translate"** → `translateOnly()` → calls `translateTerm(term)` only
   - **"Suggest topic"** → `suggestOnly()` → requires translation already filled → calls `suggestTopic(term, translation)`
5. User reviews/edits translation and topic, clicks "Save word"
6. `save()` → ensures topic exists (creates Inbox if needed) → calls `quickAddWord(term, translation, [topicId])`
7. `quickAddWord()` sends `POST /api/words` with `{term, translations: translation, topic_ids, knowledge_level: 1}`
8. ⚠️ Backend receives `translations` (unknown field) → `WordCreate` has `extra="forbid"` → **422 error**

### Edit Form Flow (end-to-end)

1. User navigates to word page → clicks "Edit"
2. `useWordPageState()` creates `EditState` via `toEditState(word)` — maps `translation_entries` → newline-joined `translations` string, `example_entries` → newline-joined `example` string
3. User edits fields in `WordPageEditForm`
4. On save → `buildSavePayload(draft, isVerb, isNoun)` → splits textareas back to arrays, sends `translation_entries: string[]` and `example_entries: string[]` (correct field names)
5. `updateWord(id, payload)` → `PUT /api/words/:id` → works correctly

## Bugs Found

### 🔴 Critical: Quick Add sends wrong field name

**Location**: `frontend/src/features/words/api/wordsApi.ts` line ~25

```typescript
// CURRENT (broken):
export const quickAddWord = (term: string, translation: string, topicIds: number[]) =>
  request<Word>(
    '/api/words',
    {method: 'POST', body: JSON.stringify({term, translations: translation, topic_ids: topicIds, knowledge_level: 1})},
  )
```

- Sends `translations` (string) — backend `WordCreate` expects `translation_entries` (list of strings)
- `WordCreate` has `extra="forbid"` → **422 Unprocessable Entity**
- Translation data is lost even if the word somehow gets created

**Fix**: `{term, translation_entries: [translation], topic_ids: topicIds, knowledge_level: 1}`

### 🟡 Edit form missing "phrasal verb" POS option

**Location**: `frontend/src/features/words/components/WordPageEditForm.tsx`

The part_of_speech `<select>` has options: noun, verb, adjective, adverb, phrase, preposition, other.
But `wordDomain.ts` defines `POS_VALUES` with 8 values including `phrasal verb`, and the backend `PART_OF_SPEECH_VALUES` also includes `phrasal verb`.
Words with POS "phrasal verb" cannot be set or preserved via the edit form.

### 🟡 Edit form countability values are capitalized wrong

**Location**: `frontend/src/features/words/components/WordPageEditForm.tsx`

The countability `<select>` sends capitalized values: `Countable`, `Uncountable`, `Both`, `Plural`, `Collective`.
But the backend DB CHECK constraint expects lowercase: `countable`, `uncountable`, `both`, `plural`, `collective`.
This will cause a DB constraint violation when saving a noun with countability set via the edit form.

### 🟡 Edit form missing many enrichable fields

**Location**: `frontend/src/features/words/components/WordPageEditForm.tsx`

The `EditState` type and `WordPageEditForm` component are missing these fields that exist in the `Word` type and backend schema:

| Missing field | Backend type | Notes |
|---------------|-------------|-------|
| `definition` | text | No input in edit form |
| `pronunciation_ipa` | varchar(255) | No input in edit form |
| `cefr_level` | varchar(2) | No select in edit form |
| `register` | varchar(20) | No select in edit form |
| `synonym_entries` | list of text | No textarea in edit form |
| `antonym_entries` | list of text | No textarea in edit form |
| `collocation_entries` | list of text | No textarea in edit form |
| `confusable_entries` | list of {value, explanation} | No input in edit form |
| `present_participle` | varchar(255) | In `VerbForm` but not in `EditState` — only `past_simple` and `past_participle` are editable |
| `third_person` | varchar(255) | In `VerbForm` but not in `EditState` |
| `frequency_rank` | int | No input in edit form |
| `image_url` | varchar(512) | No input in edit form |
| `pronunciation_audio_url` | varchar(512) | No input in edit form |

This means: even if enrichment fills all 17 fields on word creation, the edit form cannot display or modify 13 of them. The `buildSavePayload()` function also hardcodes `present_participle: null` and `third_person: null` for verbs, which would **overwrite** any enriched values on save.

### 🟡 Minor: Duplicate check is global, not topic-scoped

- `existing_normalized_terms()` in `domain.py` ignores `topic_ids` and checks ALL words
- DB unique constraint is `(term, part_of_speech_id, language)` — also global
- Same word with different meanings in different topics is blocked
- May be intentional design, but worth noting

## Summary

> ⚠️ This summary describes the **pre-implementation** state. See below for current status.

- **15 tables** total, **10 word-related**
- **17 enrichable fields** on a word — only 3 auto-filled (term, language, knowledge_level)
- **Translation is broken** due to field name mismatch in `quickAddWord()` — MyMemory translation call itself works, but the result is sent with wrong key and rejected by backend
- **No automated enrichment** — all AI workflows are manual export/import
- **2 external APIs** currently integrated: MyMemory (weak, frontend-side) and OpenAI-compatible (topic suggestion only, backend-side)
- **Edit form is incomplete** — missing 13 of 17 enrichable fields, has wrong countability casing, missing "phrasal verb" POS
- **Edit form overwrites verb data** — `buildSavePayload()` hardcodes `present_participle: null` and `third_person: null`, destroying any enriched values on save
- **QuickAddSheet only sends 3 fields** — term, translation (broken), topic_ids — even if enrichment fills all 17 fields, the quick-add save payload ignores them

---

## Post-Implementation Status

> Updated: 2026-05-03 after Phases 0–4 completed.

### Bugs Fixed

| Bug | Status |
|-----|--------|
| 🔴 `quickAddWord()` sends `translations` instead of `translation_entries` | ✅ Fixed — sends `translation_entries: [translation]` via object payload |
| 🟡 Edit form missing "phrasal verb" POS option | ✅ Fixed — added to select |
| 🟡 Edit form countability sends Capitalized values | ✅ Fixed — all lowercase |
| 🟡 Edit form missing 13 enrichable fields | ✅ Fixed — all added (definition, IPA, CEFR, register, frequency_rank, present_participle, third_person, synonyms, antonyms, collocations) |
| 🟡 `buildSavePayload()` destroys verb form data | ✅ Fixed — reads all 4 verb form fields from draft |
| 🟡 `isVerb` check missing "phrasal verb" | ✅ Fixed — includes both "verb" and "phrasal verb" |

### New Components

| Component | Location |
|-----------|----------|
| `POST /api/words/enrich` | `backend/app/features/words/enrich/router.py` |
| Free Dictionary API client | `backend/app/features/words/enrich/dictionary_client.py` |
| Gemini AI client | `backend/app/features/words/enrich/gemini_client.py` |
| Merge logic | `backend/app/features/words/enrich/merge.py` |
| Enrichment schemas | `backend/app/features/words/enrich/schemas.py` |
| `enrichWord()` frontend API | `frontend/src/features/words/api/wordsApi.ts` |
| `EnrichResult` type | `frontend/src/features/words/types/wordTypes.ts` |
| `EnrichPreview` component | `frontend/src/features/words/components/QuickAddSheet.tsx` |

### Removed Components

| Removed | Was in |
|---------|--------|
| `translateTerm()` (MyMemory) | `quickAddAssistApi.ts` |
| `suggestTopic()` | `quickAddAssistApi.ts` |
| `translateOnly()`, `suggestOnly()`, `autoFill()` | `useQuickAdd.ts` |
| "Auto-fill AI", "Translate", "Suggest topic" buttons | `QuickAddSheet.tsx` |

### Remaining Pre-existing Issues (not in scope)

| Issue | Severity |
|-------|----------|
| No Pydantic validation for cefr_level/register/countability/language in WordCreate | P1 |
| Unknown part_of_speech silently becomes NULL | P1 |
| Trashed words block new creation with misleading error | P1 |
| Race condition on concurrent duplicate creation → 500 | P2 |
| QuickAddSheet only on StudyPage | P2 |
