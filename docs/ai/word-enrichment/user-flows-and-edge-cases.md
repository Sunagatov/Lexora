# Add New Word — All User Flows, Scenarios & Edge Cases

> Full trace: Frontend UI → Hooks → API calls → Backend endpoints → DB operations
> Scanned: 2026-05-03
>
> ⚠️ The flows below describe the **pre-implementation** state. See [Post-Implementation Summary](#post-implementation-summary) at the bottom for what changed.

---

## Entry Points

All paths that create words in Lexora:

| # | Flow | Frontend Trigger | Backend Route | AI/Translate? |
|---|------|-----------------|---------------|---------------|
| 1 | **Quick Add** (single word) | `QuickAddSheet` FAB on **StudyPage only** | `POST /api/words` | ✅ ~~MyMemory + OpenAI~~ → now Gemini + Free Dictionary API via `POST /api/words/enrich` |
| 2 | **XLSX Workbook Import** | File input in topic sidebar | `POST /api/words/import/xlsx` | ❌ none |
| 3 | **Bulk API Import** | None (agent/external API only, `X-Api-Key` auth) | `POST /api/words/bulk` | ❌ none |
| 4 | **AI Curation Import** | None (manual copy-paste workflow) | `POST /api/ai-curation/import` | ❌ (AI is external, not in-app) |

> **Key finding**: `QuickAddSheet` is rendered in exactly ONE place — `StudyPage.tsx`. There is no "Add word" button on topic pages, `AllWordsPage`, or `WordPage`. The only way to add a single word via the UI is from the Study page FAB.

This document covers **Flow 1 (Quick Add)** in full detail — the only flow that involves AI/translate API integrations. Flows 2–4 are noted for completeness but are separate code paths with no AI involvement.

---

## Flow 1: Happy Path — Manual Entry (No AI)

### Steps

```
User                          Frontend                              Backend                          DB
─────                         ────────                              ───────                          ──
1. Opens QuickAddSheet        useQuickAdd() initializes
                              → fetches topics (GET /api/topics)
                              → auto-selects Inbox topic
                              
2. Types "resilient"          setTerm("resilient")

3. Types "устойчивый"         setTranslation("устойчивый")

4. Selects topic "Emotions"   setTopicId(5)

5. Clicks "Save word"         save()
                              → validates term non-empty ✓
                              → validates translation non-empty ✓
                              → quickAddWord("resilient",
                                "устойчивый", [5])
                              → POST /api/words
                                {term: "resilient",
                                 translations: "устойчивый",     ← ⚠️ WRONG FIELD NAME
                                 topic_ids: [5],
                                 knowledge_level: 1}
                                                                    Pydantic WordCreate
                                                                    → extra="forbid"
                                                                    → "translations" is unknown
                                                                    → 422 Unprocessable Entity     ← FAILS HERE
                              
                              ← ApiError(422, "...")
                              → onError: "Failed to save.
                                Try again."
```

### Verdict: 🔴 BROKEN

The happy path **does not work**. Every quick-add attempt fails with 422 because `quickAddWord()` sends `translations` (string) instead of `translation_entries` (list of strings).

### What would happen if the field name were correct

If we fix to `translation_entries: ["устойчивый"]`:

```
                                                                    Pydantic WordCreate ✓
                                                                    assert_topics_exist(db, [5])
                                                                    → SELECT id FROM topics
                                                                      WHERE id IN (5)
                                                                      AND deleted_at IS NULL       → found ✓
                                                                    existing_normalized_terms(db)
                                                                    → SELECT term FROM words       ← full table scan
                                                                    → normalize all terms
                                                                    assert_no_duplicate_word
                                                                    → "resilient" not in set ✓
                                                                    _resolve_pos_id(db, None)      → None
                                                                    INSERT INTO words (...)
                                                                    INSERT INTO word_topics (...)
                                                                    INSERT INTO word_translations
                                                                      (word_id, position=0,
                                                                       value="устойчивый")
                                                                    COMMIT                          ✓
                                                                    → 201 Created + WordResponse

                              ← Word object
                              → invalidateWordDependencies()
                              → feedback: "resilient saved!"
                              → clear form, focus term input
```

---

## Flow 2: Auto-fill AI (Translate + Suggest Topic)

### Steps

```
User                          Frontend                              Backend                          External APIs
─────                         ────────                              ───────                          ─────────────
1. Types "resilient"          setTerm("resilient")

2. Clicks "✨ Auto-fill AI"  autoFill()
                              → validates term non-empty ✓
                              → setAssist('autofill', 'translating')
                              
                              requestTranslation("resilient")
                              → fetch("https://api.mymemory.
                                translated.net/get?q=resilient
                                &langpair=en|ru")
                                                                                                     MyMemory API
                                                                                                     → 200 OK
                                                                                                     → {responseData:
                                                                                                        {translatedText:
                                                                                                         "устойчивый"}}
                              ← "устойчивый"
                              → setTranslation("устойчивый")
                              → setTranslationAiDone(true)
                              
                              → setAssist('autofill', 'suggesting')
                              requestTopicSuggestion(
                                "resilient", "устойчивый")
                              → POST /api/words/suggest-topic
                                {term: "resilient",
                                 translation: "устойчивый"}
                                                                    suggest_topic_for_word(db,
                                                                      "resilient", "устойчивый")
                                                                    → check openai_api_key ≠ ""
                                                                    → SELECT name FROM topics
                                                                      WHERE deleted_at IS NULL
                                                                    → build prompt with topic list
                                                                    → POST {openai_base_url}/
                                                                      chat/completions
                                                                      model: gpt-4o-mini
                                                                      messages: [system, user]
                                                                                                     GitHub Models API
                                                                                                     → 200 OK
                                                                                                     → {choices: [{
                                                                                                        message: {
                                                                                                          content:
                                                                                                          "Emotions"}}]}
                                                                    → match "Emotions" against
                                                                      topic names ✓
                                                                    → 200 {topic_name: "Emotions"}
                              
                              ← {topic_name: "Emotions"}
                              → findTopicByName(topics, "Emotions")
                              → setTopicId(match.id)
                              → setAiSuggested(true)
                              → setTopicAiDone(true)
                              → clearAssist()
                              
                              UI shows:
                              - Translation: "устойчивый" ✓ AI filled
                              - Topic: "Emotions" ✨ AI suggested

3. Clicks "Save word"        → same as Flow 1 step 5
                              → 🔴 FAILS with 422 (wrong field name)
```

### Verdict: 🟡 AI assist works, save is broken

The translate + suggest flow works correctly. The save fails for the same reason as Flow 1.

---

## Flow 3: Translate Only

```
User                          Frontend                              External APIs
─────                         ────────                              ─────────────
1. Types "ephemeral"          setTerm("ephemeral")

2. Clicks "Translate"         translateOnly()
                              → validates term non-empty ✓
                              → setAssist('translate', 'translating')
                              → translateTerm("ephemeral")
                              → fetch(MyMemory API)
                                                                     MyMemory → "эфемерный"
                              ← "эфемерный"
                              → setTranslation("эфемерный")
                              → setTranslationAiDone(true)
                              → clearAssist()
```

### Verdict: ✅ Works (translation fills correctly)

---

## Flow 4: Suggest Topic Only

```
User                          Frontend                              Backend
─────                         ────────                              ───────
1. Types "ephemeral"          setTerm("ephemeral")
2. Types "эфемерный"          setTranslation("эфемерный")

3. Clicks "Suggest topic"     suggestOnly()
                              → validates term non-empty ✓
                              → validates translation non-empty ✓
                              → setAssist('suggest', 'suggesting')
                              → suggestTopic("ephemeral", "эфемерный")
                              → POST /api/words/suggest-topic
                                                                    → suggest_topic_for_word(...)
                                                                    → AI call → "Vocabulary"
                                                                    → 200 {topic_name: "Vocabulary"}
                              ← {topic_name: "Vocabulary"}
                              → findTopicByName(topics, "Vocabulary")
                              → setTopicId(match.id)
                              → clearAssist()
```

### Verdict: ✅ Works (topic suggestion fills correctly)

---

## Flow 5: Save Without Topic Selected (Inbox Fallback)

```
User                          Frontend                              Backend
─────                         ────────                              ───────
1. Types term + translation
2. Does NOT select a topic    topicId = null

3. Clicks "Save word"         save()
                              → topicId is null
                              → ensureInboxTopic(topics, onCreated)
                              → finds "Inbox" topic in local list
                                (case-insensitive)
                              
                              If Inbox exists:
                              → resolvedTopicId = inbox.id
                              → quickAddWord(term, translation,
                                [inbox.id])
                              
                              If Inbox does NOT exist:
                              → createTopic("Inbox")
                              → POST /api/topics
                                {name: "Inbox"}
                                                                    → creates topic
                                                                    → 201 {id: 99, name: "Inbox",
                                                                           slug: "inbox", ...}
                              ← created topic
                              → invalidate topics + stats queries
                              → setTopicId(99)
                              → resolvedTopicId = 99
                              → quickAddWord(...)
                              → 🔴 FAILS with 422 (same bug)
```

### Verdict: 🟡 Inbox fallback logic works, save still broken

---

## Edge Cases — Frontend

### EC-1: Empty term

```
User clicks "Save word" with empty term
→ save() → trimmedTerm.length === 0
→ feedback: "Word or phrase is required."
→ focus term input
→ NO API call made
```
**Verdict: ✅ Handled**

### EC-2: Empty translation

```
User clicks "Save word" with term but no translation
→ save() → trimmedTranslation.length === 0
→ feedback: "Translation is required."
→ NO API call made
```
**Verdict: ✅ Handled**

### EC-3: Empty term + click "Auto-fill AI"

```
User clicks "✨ Auto-fill AI" with empty term
→ autoFill() → validateTerm("") → false
→ feedback: "Enter a word first."
→ focus term input
→ NO API call made
```
**Verdict: ✅ Handled**

### EC-4: Empty term + click "Translate"

```
Same as EC-3 — validateTerm check prevents API call.
```
**Verdict: ✅ Handled**

### EC-5: Empty translation + click "Suggest topic"

```
User clicks "Suggest topic" without translation
→ suggestOnly() → validateTranslation("") → false
→ feedback: "Enter a translation first so AI can suggest a topic."
→ NO API call made
```
**Verdict: ✅ Handled**

### EC-6: Double-click "Save word" (rapid submit)

```
User clicks "Save word" twice quickly
→ first save() → addWordMutation.mutate(topicId)
→ second save() → addWordMutation.isPending === true → early return
→ canSave becomes false (button disabled)
```
**Verdict: ✅ Handled** (mutation pending check + button disabled)

### EC-7: Duplicate word (409 from backend)

```
User saves a word that already exists
→ quickAddWord() → POST /api/words
→ backend: assert_no_duplicate_word → DuplicateWordInTopicError
→ 409 Conflict
→ frontend: err instanceof ApiError && err.status === 409
→ feedback: '"resilient" already exists in your library'
```
**Verdict: ✅ Handled** (but currently unreachable due to 422 bug)

### EC-8: User edits translation after AI fill

```
User clicks "Auto-fill AI" → translation filled
User manually edits the translation
→ setTranslation(v) → resets aiSuggested=false, translationAiDone=false
→ "✓ AI filled" badge disappears
→ Topic suggestion is NOT re-triggered automatically
```
**Verdict: ✅ Handled** (AI markers reset on manual edit)

### EC-9: User changes topic after AI suggestion

```
User clicks "Auto-fill AI" → topic suggested
User manually selects a different topic
→ setTopicId(id) → resets aiSuggested=false, topicAiDone=false
→ "✨ AI suggested" badge disappears
```
**Verdict: ✅ Handled**

### EC-10: Term with leading/trailing whitespace

```
User types "  resilient  "
→ save() → term.trim() → "resilient"
→ Backend: WordCreate has str_strip_whitespace=True → "resilient"
→ Backend: normalize_term() → NFKC + collapse whitespace + strip + lowercase
```
**Verdict: ✅ Handled** (both frontend and backend trim)

### EC-11: Term with Unicode characters

```
User types "naïve" or "café"
→ Backend: normalize_term() → NFKC normalization → "naïve" / "café"
→ Duplicate check uses normalized form
```
**Verdict: ✅ Handled**

### EC-12: Very long term (>255 chars)

```
User types a term longer than 255 characters
→ Backend: WordCreate → term max_length=255 → 422
→ Frontend: no maxLength on term input → user can type it
→ Error shown as "Failed to save. Try again." (generic)
```
**Verdict: ⚠️ Partially handled** — no frontend maxLength, generic error message

### EC-13: Session expired during save

```
User's session expires while form is open
→ quickAddWord() → POST /api/words
→ Backend: verify_session → 401 Unauthorized
→ Frontend: request() → throw ApiError(401, "Not authenticated")
→ useQuickAdd onError → "Failed to save. Try again."
→ BUT: React Query global handler or redirectIfUnauthorized is NOT called
  in the save mutation's onError — it just shows generic error
```
**Verdict: ⚠️ Partially handled** — user sees generic error, not redirected to login. The `redirectIfUnauthorized` is only used in `suggestTopic()`, not in `save()`.

### EC-14: CSRF token missing/invalid

```
User's CSRF token is stale or missing
→ POST /api/words → Backend: verify_csrf → 403 Forbidden
→ Frontend: ApiError(403, "Missing CSRF token")
→ onError: "Failed to save. Try again." (generic)
```
**Verdict: ⚠️ Partially handled** — generic error, no CSRF refresh logic

### EC-15: Network failure during save

```
User is offline or network drops
→ fetch() throws TypeError (network error)
→ NOT an ApiError → onError: "Failed to save. Try again."
```
**Verdict: ✅ Handled** (generic catch-all)

### EC-16: Escape key closes sheet without saving

```
User presses Escape at any point
→ document keydown listener → onClose()
→ Sheet closes, form state is lost
→ No confirmation dialog
```
**Verdict: ⚠️ No unsaved changes warning** — user loses typed data

### EC-17: Overlay click closes sheet

```
User clicks the overlay behind the sheet
→ onClose()
→ Same as EC-16 — no confirmation
```
**Verdict: ⚠️ No unsaved changes warning**

---

## Edge Cases — MyMemory Translation API

### EC-18: MyMemory returns the same word back

```
User types "hello"
→ translateTerm("hello")
→ MyMemory returns {translatedText: "hello"} (same as input)
→ text.toLowerCase() === term.toLowerCase() → true
→ return null
→ feedback: "Translation not found — please enter it manually."
```
**Verdict: ✅ Handled**

### EC-19: MyMemory API is down

```
→ fetch(MyMemory URL) → response.ok === false (500/503)
→ return null
→ feedback: "Translation not found — please enter it manually."
```
**Verdict: ✅ Handled** (graceful degradation)

### EC-20: MyMemory API network timeout

```
→ fetch(MyMemory URL) → throws (no explicit timeout set)
→ catch → return null
→ feedback: "Translation not found — please enter it manually."
```
**Verdict: ⚠️ No timeout configured** — fetch could hang indefinitely. Browser will eventually timeout but it could take 30+ seconds.

### EC-21: MyMemory returns garbage/HTML

```
→ fetch(MyMemory URL) → 200 but body is HTML (rate limit page)
→ response.json() → throws
→ catch → return null
→ feedback: "Translation not found — please enter it manually."
```
**Verdict: ✅ Handled** (catch block)

### EC-22: Term with special characters in URL

```
User types "it's" or "well-known"
→ encodeURIComponent("it's") → "it's" encoded properly
→ MyMemory handles it
```
**Verdict: ✅ Handled** (encodeURIComponent used)

### EC-23: Non-English term

```
User types a Russian word (language is always en→ru)
→ MyMemory translates ru→ru → likely returns same word
→ EC-18 applies → null → manual entry
```
**Verdict: ⚠️ No language detection** — hardcoded en|ru direction

---

## Edge Cases — Topic Suggestion (OpenAI-compatible API)

### EC-24: OPENAI_API_KEY not configured

```
→ POST /api/words/suggest-topic
→ suggest_topic_for_word() → settings.openai_api_key is ""
→ raise AiNotConfiguredError
→ 503 Service Unavailable: "AI not configured"
→ Frontend: suggestTopic() catches error
→ redirectIfUnauthorized(error) → not 401/403 → no redirect
→ return null
→ applySuggestedTopic(null) → false
→ feedback: "Could not suggest a topic — please select one manually."
```
**Verdict: ✅ Handled**

### EC-25: No topics exist in DB

```
→ suggest_topic_for_word() → SELECT name FROM topics → empty
→ raise NoTopicsError
→ 404: "No topics found"
→ Frontend: return null → feedback: "Could not suggest a topic..."
```
**Verdict: ✅ Handled**

### EC-26: AI returns a topic name not in the list

```
→ AI responds with "Science" but no topic named "Science" exists
→ case-insensitive match fails
→ raise AiUnknownTopicError("Science")
→ 422: "AI returned unknown topic"
→ Frontend: return null
→ feedback: "Could not suggest a topic..."
```
**Verdict: ✅ Handled**

### EC-27: AI returns empty or malformed response

```
→ AI responds with empty content or missing choices
→ _extract_choice_content() → raise AiMalformedResponseError
→ 502: "AI returned malformed response"
→ Frontend: return null → feedback message
```
**Verdict: ✅ Handled**

### EC-28: AI request times out (>10s)

```
→ httpx.AsyncClient(timeout=10.0) → httpx.TimeoutException
→ 504: "AI request timed out"
→ Frontend: return null → feedback message
```
**Verdict: ✅ Handled**

### EC-29: AI returns HTTP error (429 rate limit, 500, etc.)

```
→ response.raise_for_status() → httpx.HTTPStatusError
→ 502: "AI error: {status_code}"
→ Frontend: return null → feedback message
```
**Verdict: ✅ Handled**

### EC-30: AI connection refused / DNS failure

```
→ httpx.RequestError
→ 502: "AI connection error: {error_type}"
→ Frontend: return null → feedback message
```
**Verdict: ✅ Handled**

### EC-31: Session expired during suggest-topic call

```
→ POST /api/words/suggest-topic → 401
→ Frontend: suggestTopic() catches error
→ redirectIfUnauthorized(error) → 401 → redirect to login
```
**Verdict: ✅ Handled** (redirects to login)

### EC-32: AI returns topic with different casing

```
→ AI responds "emotions" but topic is "Emotions"
→ exact match fails → case-insensitive match succeeds
→ returns "Emotions" (correct casing)
```
**Verdict: ✅ Handled**

---

## Edge Cases — Backend Word Creation

### EC-33: Invalid cefr_level value

```
→ POST /api/words {cefr_level: "X1"}
→ Pydantic: no validation → passes
→ DB: CHECK constraint ck_words_cefr_level → IntegrityError
→ UNHANDLED → 500 Internal Server Error
```
**Verdict: 🔴 UNHANDLED** — no Pydantic validation, DB error not caught

### EC-34: Invalid register value

```
→ POST /api/words {register: "Formal"} (capitalized)
→ Pydantic: no validation → passes
→ DB: CHECK constraint ck_words_register → IntegrityError
→ UNHANDLED → 500
```
**Verdict: 🔴 UNHANDLED** — same issue. This is exactly what the edit form's countability bug would trigger.

### EC-35: Invalid language value

```
→ POST /api/words {language: "fr"}
→ Pydantic: no validation → passes
→ DB: CHECK constraint ck_words_language → IntegrityError
→ UNHANDLED → 500
```
**Verdict: 🔴 UNHANDLED**

### EC-36: Unknown part_of_speech value

```
→ POST /api/words {part_of_speech: "conjunction"}
→ _resolve_pos_id(db, "conjunction") → SELECT FROM parts_of_speech WHERE name = "conjunction" → None
→ word.part_of_speech_id = None (silently ignored)
→ Word created with NULL POS
```
**Verdict: ⚠️ Silent data loss** — invalid POS silently becomes NULL instead of returning an error

### EC-37: Duplicate word (same normalized term, any topic)

```
→ "Resilient" exists in topic "Emotions"
→ User tries to add "resilient" to topic "Work"
→ existing_normalized_terms() → loads ALL terms (ignores topic_ids)
→ normalize_term("resilient") → "resilient" → found in set
→ DuplicateWordInTopicError → 409
```
**Verdict: ⚠️ By design but surprising** — global duplicate check prevents same word in different topics

### EC-38: Duplicate word in trash (soft-deleted)

```
→ "resilient" was deleted (deleted_at is set)
→ User tries to add "resilient" again
→ existing_normalized_terms() → no deleted_at filter → includes trashed words
→ DuplicateWordInTopicError → 409
→ User sees: '"resilient" already exists in your library'
→ User has no idea it's in the trash
```
**Verdict: 🔴 BAD UX** — user can't add a word that's in the trash, and the error message doesn't mention the trash

### EC-39: Concurrent duplicate creation (race condition)

```
→ Request A: existing_normalized_terms() → "resilient" not found
→ Request B: existing_normalized_terms() → "resilient" not found
→ Request A: INSERT + COMMIT → success
→ Request B: INSERT + COMMIT → DB unique constraint violation
→ IntegrityError → UNHANDLED → 500
```
**Verdict: 🔴 UNHANDLED** — race condition causes 500 instead of 409

### EC-40: Topic deleted between validation and insert

```
→ assert_topics_exist(db, [5]) → topic 5 exists ✓
→ Another request soft-deletes topic 5
→ _load_topics(db, [5]) → loads topic 5 (no deleted_at filter)
→ Word created with soft-deleted topic
```
**Verdict: ⚠️ Minor race** — word gets linked to a deleted topic. Low probability.

### EC-41: Negative or zero topic_id

```
→ POST /api/words {topic_ids: [0, -1]}
→ Pydantic: no gt=0 validation on list items → passes
→ assert_topics_exist → SELECT WHERE id IN (0, -1) → not found
→ 400: "Topics not found: [0, -1]"
```
**Verdict: ✅ Handled** (caught by topic existence check, not by schema)

### EC-42: Very large entry lists

```
→ POST /api/words {translation_entries: [... 10000 items ...]}
→ Pydantic: no max_length on list → passes
→ _sync_entry_tables → creates 10000 WordTranslation rows
→ DB: slow INSERT, possible timeout
```
**Verdict: ⚠️ No list size limit** — could cause performance issues

### EC-43: Entry with only whitespace

```
→ POST /api/words {translation_entries: ["  ", "\t"]}
→ Pydantic: str_strip_whitespace → "  " becomes ""
→ _clean() → filters empty strings → empty list
→ No translations created
```
**Verdict: ✅ Handled** (stripped + filtered)

### EC-44: Duplicate entries in list

```
→ POST /api/words {synonym_entries: ["big", "Big", "BIG"]}
→ _clean() → case-insensitive dedup → ["big"]
→ Only one synonym created
```
**Verdict: ✅ Handled**

---

## Edge Cases — Create New Topic (inline)

### EC-45: Create topic with duplicate name

```
User clicks "+ New" → types "Emotions" (already exists)
→ createTopic("Emotions") → POST /api/topics
→ Backend: slug collision or name validation → 400 or 409
→ Frontend: err.status === 400 || 409 → shows err.message
```
**Verdict: ✅ Handled**

### EC-46: Create topic with empty name

```
User clicks "+ New" → types "" → clicks "Create"
→ createTopic guard: !newTopic.trim() → early return
→ NO API call
```
**Verdict: ✅ Handled**

### EC-47: Create topic with very long name

```
User types 201+ chars → POST /api/topics
→ Backend: TopicCreate name max_length=200 → 422
→ Frontend: maxLength={200} on input → prevents typing beyond 200
```
**Verdict: ✅ Handled** (both frontend and backend)

---

## Edge Cases — XLSX Workbook Import (Flow 2)

### EC-48: XLSX import creates words without AI enrichment

```
User imports an XLSX file via topic sidebar
→ handleImportWorkbookChange() → importWordsWorkbook(file)
→ POST /api/words/import/xlsx (FormData)
→ Backend: import_words_workbook() → create_new_word_from_row()
→ Words created with whatever data is in the spreadsheet
→ NO AI enrichment, NO translation API, NO topic suggestion
→ Missing fields stay NULL
```
**Verdict: ✅ By design** — bulk import is a data migration tool, not an interactive flow

### EC-49: XLSX import auth error

```
→ POST /api/words/import/xlsx → 401
→ redirectIfUnauthorized(error) → redirects to login
```
**Verdict: ✅ Handled** (unlike quick-add save, XLSX import does call `redirectIfUnauthorized`)

### EC-50: XLSX import with invalid file

```
User selects a non-XLSX file
→ Backend: openpyxl fails to parse → 400 or 422
→ Frontend: window.alert(error.message)
```
**Verdict: ✅ Handled** (alert-based error display)

---

## Edge Cases — QuickAddSheet Availability

### EC-51: No "Add word" button on topic pages

```
User is on a topic page viewing words
→ No FAB, no "Add word" button anywhere
→ User must navigate to Study page to add a word
```
**Verdict: ⚠️ UX gap** — the only add-word entry point is on StudyPage. Users browsing topics have no way to quick-add a word without navigating away.

### EC-52: No "Add word" button on AllWordsPage

```
User is on the "All Words" page
→ No add button, only batch update actions
→ Must navigate to Study page
```
**Verdict: ⚠️ Same UX gap**

---

## Summary Matrix

### By Status

> ⚠️ Pre-implementation assessment. See [Post-Implementation Summary](#post-implementation-summary) below.

| Status | Count | Items |
|--------|-------|-------|
| 🔴 Broken / Unhandled | 6 | Flow 1 save 422 (P0), EC-33 (cefr 500), EC-34 (register 500), EC-35 (language 500), EC-38 (trash blocks re-add), EC-39 (race condition 500) |
| ⚠️ Partial / Surprising | 10 | EC-12 (long term no maxLength), EC-13 (session expired generic error), EC-14 (CSRF generic error), EC-16/17 (no unsaved warning), EC-20 (no MyMemory timeout), EC-23 (hardcoded en→ru), EC-36 (silent POS null), EC-37 (global dedup), EC-42 (no list limit), EC-51/52 (QuickAdd only on StudyPage) |
| ✅ Handled | 38 | EC-1 through EC-11, EC-15, EC-18/19/21/22, EC-24 through EC-32, EC-41, EC-43 through EC-50 |

### By Severity — What to Fix

> ⚠️ Pre-implementation priority list. See below for what's been fixed.

| Priority | Issue | Impact | Fix |
|----------|-------|--------|-----|
| **P0** | `quickAddWord()` sends `translations` instead of `translation_entries` | **All quick-add saves fail with 422** | Change field name + wrap in array in `wordsApi.ts` |
| **P1** | No Pydantic validation for cefr_level, register, countability, language | Invalid values cause unhandled 500 instead of 422 | Add `@field_validator` or Literal types to `WordCreate` |
| **P1** | Unknown part_of_speech silently becomes NULL | Data loss — user thinks POS was saved | Return 422 if POS name not found in `parts_of_speech` table |
| **P1** | Trashed words block new creation with misleading error | User can't re-add deleted words, error says "already exists" with no mention of trash | Exclude `deleted_at IS NOT NULL` from `existing_normalized_terms()` query |
| **P2** | Race condition on duplicate check (TOCTOU) | Rare 500 on concurrent creates | Catch `IntegrityError` in router, return 409 |
| **P2** | Session expiry during save shows generic error, no redirect | User confused, keeps retrying | Add `redirectIfUnauthorized` to `useQuickAdd` save mutation's `onError` |
| **P2** | No unsaved changes warning on sheet close (Escape / overlay click) | User loses typed data + AI-filled data | Add dirty-form check + confirmation dialog |
| **P2** | QuickAddSheet only available on StudyPage | Users on topic/word pages can't add words without navigating away | Render QuickAddSheet on topic pages and/or AllWordsPage |
| **P3** | No timeout on MyMemory fetch | Could hang 30+ seconds on slow network | Add `AbortController` with 5s timeout |
| **P3** | No max_length on entry lists in `WordCreate` | Performance risk — 10K entries accepted | Add `max_length=20` to list fields |
| **P3** | No `maxLength` on term input in QuickAddSheet | 255+ chars rejected by backend with generic error | Add `maxLength={255}` to `<input>` |
| **P3** | Hardcoded `en\|ru` translation direction | Can't translate other language pairs | Low priority — app is designed for en→ru |

---

## Post-Implementation Summary

> Updated: 2026-05-03 after Phases 0–4 completed.

### Fixed by enrichment implementation

| Issue | Status |
|-------|--------|
| **P0**: `quickAddWord()` wrong field name → 422 | ✅ Fixed — sends `translation_entries: [translation]` via object payload |
| **P3**: No `maxLength` on term input | ✅ Fixed — `maxLength={255}` on both Quick Add and Edit Form |
| **P3**: MyMemory timeout / hardcoded en→ru | ✅ N/A — MyMemory removed entirely, replaced by Gemini backend enrichment |
| Edit form missing 13 fields | ✅ Fixed — 15 of 17 fields now editable |
| Edit form countability casing | ✅ Fixed — lowercase values |
| Edit form missing "phrasal verb" POS | ✅ Fixed — added to select |
| `buildSavePayload` destroys verb form data | ✅ Fixed — all 4 verb form fields preserved |
| `isVerb` check missing "phrasal verb" | ✅ Fixed — includes both "verb" and "phrasal verb" |

### Not fixed (pre-existing, out of scope)

| Issue | Status |
|-------|--------|
| **P1**: No Pydantic validation for enum fields | ⬜ Still relies on DB CHECK constraints |
| **P1**: Unknown POS silently becomes NULL | ⬜ Not changed |
| **P1**: Trashed words block re-creation | ⬜ Not changed |
| **P2**: Race condition → 500 | ⬜ Not changed |
| **P2**: Session expiry generic error | ⬜ Not changed |
| **P2**: No unsaved changes warning | ⬜ Not changed |
| **P2**: QuickAddSheet only on StudyPage | ⬜ Not changed |
