# Word Enrichment Feature — Planning Hub

> Status: **Implemented** (Phases 0–4) · Started: 2026-05-03

## Problem (pre-implementation)

These issues have been **fixed** as part of this feature:

When a user adds a new word via Quick Add, almost nothing gets auto-filled.
The word schema has 17 enrichable fields/tables, but only `term`, `language`, and `knowledge_level` are set automatically.
The MyMemory translation API call itself works (returns a Russian translation), but `quickAddWord()` sends the result as `translations` (string) instead of `translation_entries` (list of strings). Since `WordCreate` has `extra="forbid"`, the backend rejects the unknown field with a **422 error**, meaning the entire save likely fails.

The edit form (`WordPageEditForm`) is also incomplete — it only covers 6 of 17 enrichable fields, has a countability casing bug, and is missing the "phrasal verb" POS option.

The result: adding and editing words is broken or severely limited.

## Result (post-implementation)

- `POST /api/words/enrich` endpoint calls Free Dictionary API + Gemini in parallel, returns all 17 fields
- QuickAddSheet has "✨ Enrich" button — one click fills translation, definition, IPA, POS, CEFR, examples, synonyms, antonyms, collocations, verb forms, and more
- WordPageEditForm expanded from 6 to 17 editable fields with "✨ Enrich with AI" button
- All original bugs fixed: field name mismatch, countability casing, missing phrasal verb POS, verb form data loss
- MyMemory and old Auto-fill/Translate/Suggest buttons removed — replaced by single enrichment flow

## Goal

One-click enrichment that fills all 17 fields from the word's `term` alone, using **free-tier APIs only** (no paid subscriptions).

## Strategy

Two complementary data sources, called in parallel:

1. **Free Dictionary API** (dictionaryapi.dev) — no key, no rate limit
   - Reliable for: IPA pronunciation, audio URL, part of speech, basic definition
   - English words only, no phrases

2. **Google Gemini API** (free tier) — API key required, 1000 RPD / 15 RPM
   - Fills everything else: translations (en→ru), CEFR level, register, countability, examples, synonyms, antonyms, collocations, confusables, verb forms, pattern, frequency estimate, notes
   - Structured JSON output mode for reliable parsing
   - Replaces both MyMemory (better translations) and GitHub Models (more generous free tier)

Backend merges results, preferring Dictionary API for IPA/audio (more reliable) and Gemini for linguistic data.

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Gemini as primary AI provider | 1000 RPD free, structured output, better than GitHub Models free tier |
| 2 | Keep OpenAI-compatible path as optional fallback | Existing code works, some users may prefer it |
| 3 | Drop MyMemory for translation | Gemini gives contextual translations; MyMemory is literal/mechanical |
| 4 | Enrichment runs on backend, not frontend | Keeps API keys server-side, enables merging multiple sources |
| 5 | New `/api/words/enrich` endpoint | Separate from create — user reviews enriched data before saving |
| 6 | Fix Quick Add field name bug as part of this work | Blocking issue, must be fixed regardless |

## Documents

| File | Contents |
|------|----------|
| [current-state-audit.md](current-state-audit.md) | Full schema scan, current integrations, bugs found |
| [enrichment-field-map.md](enrichment-field-map.md) | All 17 enrichable fields with sources and DB constraints |
| [api-providers.md](api-providers.md) | Free tier comparison: Gemini, GitHub Models, Dictionary API, MyMemory |
| [implementation-plan.md](implementation-plan.md) | Phased tasks with checkboxes |
| [user-flows-and-edge-cases.md](user-flows-and-edge-cases.md) | All user flows, scenarios, and edge cases for add-word + AI/translate |
