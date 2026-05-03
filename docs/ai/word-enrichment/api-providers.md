# API Providers — Free Tier Comparison (May 2026)

## Summary

| Provider | Type | Free Tier | API Key? | Best For | Verdict |
|----------|------|-----------|----------|----------|---------|
| **Google Gemini** | AI (LLM) | 15 RPM, 1000 RPD, 250K TPM | Yes (free) | All linguistic data, translations, structured output | ✅ **Primary AI** |
| **GitHub Models** | AI (LLM) | Limited RPM, prototyping only | Yes (GitHub PAT) | Quick prototyping | ⚠️ Keep as fallback |
| **OpenRouter** | AI (LLM) | Free models (Gemma 4, etc.), 20 RPM, 200 RPD | Yes (free) | Backup if Gemini is down | ⚠️ Optional fallback |
| **Free Dictionary API** | Dictionary | Unlimited, no rate limit | No | IPA, audio, definition, part of speech | ✅ **Primary dictionary** |
| **MyMemory** | Translation | 5000 chars/day (anonymous) | No | Basic en→ru translation | ❌ Replace with Gemini |

## Detailed Comparison

### Google Gemini API (ai.google.dev)

**Free tier limits (as of May 2026):**

| Model | RPM | RPD | TPM |
|-------|-----|-----|-----|
| Gemini 2.5 Flash-Lite | 15 | 1,000 | 250,000 |
| Gemini 2.0 Flash-Lite | 15 | 1,000 | 250,000 |
| Gemini 2.5 Flash | 10 | 500 | 250,000 |
| Gemini 2.5 Pro | 5 | 100 | 250,000 |

**Why it wins:**
- 1000 RPD is more than enough for personal vocabulary learning (even 50 words/day = 50 requests)
- Structured JSON output mode — returns valid JSON matching our schema
- Handles translation (en→ru) as part of the same prompt — no separate translation API needed
- Supports all 17 enrichable fields in a single request
- No credit card required for free tier
- OpenAI-compatible endpoint available at `https://generativelanguage.googleapis.com/v1beta/openai/`

**Setup:**
1. Go to https://aistudio.google.com/apikey
2. Create API key (free, instant)
3. Set `GEMINI_API_KEY` in `.env`

**Recommended model:** `gemini-2.5-flash-lite` — fastest, cheapest, 15 RPM, good enough for word enrichment.

### GitHub Models (models.inference.ai.azure.com)

**Current config in Lexora:** `OPENAI_BASE_URL=https://models.inference.ai.azure.com`, model `gpt-4o-mini`

**Free tier limits:**
- Designed for prototyping, not production
- Rate limits are not publicly documented with exact numbers
- Requires GitHub PAT as bearer token

**Why it's secondary:**
- Less generous than Gemini free tier
- Intended for experimentation, not sustained use
- Already works in Lexora — keep as optional fallback

### OpenRouter (openrouter.ai)

**Free models available (May 2026):**
- `google/gemma-4-31b-it:free` — 20 RPM, 200 RPD
- `google/gemma-4-26b-a4b-it:free` — 20 RPM, 200 RPD
- `openrouter/free` — random free model router

**Why it's a backup option:**
- Free models rotate and may be unreliable
- 200 RPD is lower than Gemini's 1000 RPD
- OpenAI-compatible API — easy to integrate
- Good as emergency fallback if Gemini is down

### Free Dictionary API (dictionaryapi.dev)

**Endpoint:** `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`

**Limits:** None documented. No API key. Completely free.

**Returns:**
- `phonetics[].text` → IPA pronunciation
- `phonetics[].audio` → MP3 audio URL (Google-hosted)
- `meanings[].partOfSpeech` → part of speech
- `meanings[].definitions[].definition` → definition text
- `meanings[].definitions[].example` → usage example
- `meanings[].definitions[].synonyms` → synonym list
- `meanings[].definitions[].antonyms` → antonym list

**Limitations:**
- English only (no Russian translations)
- Single words only — phrases and phrasal verbs return 404
- No CEFR, register, countability, collocations, confusables, verb forms
- Some words have empty phonetics or missing audio

**Why it's essential:**
- IPA and audio URLs are the most reliable from a dictionary source
- AI-generated IPA is often wrong
- No rate limit means it never blocks the user
- Instant response (< 200ms typically)

### MyMemory (api.mymemory.translated.net)

**Current usage in Lexora:** Frontend calls `translateTerm()` for en→ru translation.

**Free tier:** 5000 characters/day (anonymous), 50,000 chars/day with free API key.

**Why we're replacing it:**
- Translations are literal/mechanical — no context awareness
- Gemini gives 2–3 contextual translations as part of the enrichment prompt
- One fewer external dependency
- Frontend-side API call exposes the translation flow to CORS issues

## Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Backend: /api/words/enrich          │
│                                                     │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │ Free Dictionary   │    │ Gemini 2.5 Flash-Lite │  │
│  │ API (no key)      │    │ (GEMINI_API_KEY)      │  │
│  │                   │    │                       │  │
│  │ → IPA             │    │ → translations (ru)   │  │
│  │ → audio URL       │    │ → CEFR level          │  │
│  │ → definition      │    │ → register            │  │
│  │ → part of speech  │    │ → countability         │  │
│  │ → some synonyms   │    │ → examples (×3)       │  │
│  │ → some antonyms   │    │ → synonyms            │  │
│  │ → some examples   │    │ → antonyms            │  │
│  └────────┬─────────┘    │ → collocations        │  │
│           │               │ → confusables         │  │
│           │               │ → verb forms          │  │
│           │               │ → pattern             │  │
│           │               │ → frequency rank      │  │
│           │               │ → notes               │  │
│           │               └──────────┬────────────┘  │
│           │                          │               │
│           └──────────┬───────────────┘               │
│                      ▼                               │
│              Merge & Validate                        │
│         (DICT preferred for IPA/audio,               │
│          AI for everything else,                     │
│          combine lists, enforce DB constraints)      │
│                      │                               │
│                      ▼                               │
│            EnrichmentResponse JSON                   │
└─────────────────────────────────────────────────────┘
```

## Config Changes ✅ Done

```bash
# .env.example (added):
GEMINI_API_KEY=                    # Free: https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.5-flash-lite  # Best free-tier balance of speed/quality

# Existing (kept as optional fallback for suggest-topic):
OPENAI_API_KEY=
OPENAI_BASE_URL=https://models.inference.ai.azure.com
OPENAI_MODEL=gpt-4o-mini
```

## Cost Analysis

For personal vocabulary learning (realistic usage):

| Scenario | Requests/day | Gemini free tier (1000 RPD) | Cost |
|----------|-------------|---------------------------|------|
| Light use | 5–10 words | 0.5–1% of quota | $0 |
| Normal use | 20–30 words | 2–3% of quota | $0 |
| Heavy use | 50–100 words | 5–10% of quota | $0 |
| Bulk import (one-time) | 500 words | 50% of quota | $0 |

Even heavy daily use stays well within the free tier. The 15 RPM limit means at most ~1 enrichment every 4 seconds, which is fine for interactive use.
