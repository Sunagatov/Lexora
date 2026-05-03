# Enrichment Field Map

> All 17 enrichable fields/tables on a Word, their data sources, and DB constraints.

## Source Legend

| Code | Source | Reliability |
|------|--------|-------------|
| **DICT** | Free Dictionary API (`dictionaryapi.dev`) | High for single English words; no phrases, no Russian |
| **AI** | Gemini API (structured JSON prompt) | Good for everything; may hallucinate on rare words |
| **MERGE** | Use DICT when available, fall back to AI | Best of both |

## Field Map

> ✅ Updated post-implementation. The "Edit Form?" column reflects the current state after Phase 3.

| # | Field / Table | DB Type & Constraints | Source | Edit Form? | Notes |
|---|---------------|----------------------|--------|------------|-------|
| 1 | `definition` | text, nullable | **MERGE** | ✅ textarea | DICT gives concise definition; AI gives richer context. Prefer DICT, fall back to AI. |
| 2 | `pronunciation_ipa` | varchar(255), nullable | **DICT** | ✅ text input | DICT returns `phonetics[].text` (IPA). AI-generated IPA is unreliable. |
| 3 | `pronunciation_audio_url` | varchar(512), nullable | **DICT** | ❌ not in form (saved via Quick Add enrichment) | DICT returns `phonetics[].audio` (Google-hosted MP3). No AI equivalent. |
| 4 | `part_of_speech` | FK → `parts_of_speech.name` | **MERGE** | ✅ select (includes "phrasal verb") | DICT returns `meanings[].partOfSpeech`. AI confirms. Must match one of 8 values. |
| 5 | `cefr_level` | varchar(2), CHECK: A1/A2/B1/B2/C1/C2 | **AI** | ✅ select (A1–C2) | Not available from DICT. AI estimates based on word frequency/complexity. |
| 6 | `register` | varchar(20), CHECK: formal/informal/neutral/slang/technical | **AI** | ✅ select | Not available from DICT. |
| 7 | `countability` | varchar(20), CHECK: countable/uncountable/both/plural/collective | **AI** | ✅ select (noun only, lowercase values) | Not available from DICT. Only shown for nouns. |
| 8 | `frequency_rank` | int, CHECK: ≥ 1 | **AI** | ✅ number input | Approximate rank in English frequency lists. AI estimates. |
| 9 | `pattern` | text, nullable | **AI** | ✅ text input | Grammatical pattern, e.g. "verb + to-infinitive", "adjective + noun". |
| 10 | `translation_entries` | list of text (word_translations table) | **AI** | ✅ textarea (newline-separated) | En→Ru translations with context. AI gives 2–3 contextual translations. |
| 11 | `example_entries` | list of text (word_examples table) | **MERGE** | ✅ textarea (newline-separated) | DICT gives 1–2 examples per meaning. AI generates 3 graded examples. Target: 3 total. |
| 12 | `synonym_entries` | list of text (word_synonyms table) | **MERGE** | ✅ textarea (newline-separated) | DICT returns `definitions[].synonyms`. AI supplements. 3–5 synonyms. |
| 13 | `antonym_entries` | list of text (word_antonyms table) | **MERGE** | ✅ textarea (newline-separated) | DICT returns `definitions[].antonyms`. AI supplements. 2–3 antonyms. |
| 14 | `collocation_entries` | list of text (word_collocations table) | **AI** | ✅ textarea (newline-separated) | Not available from DICT. AI generates common collocations. 3–5 entries. |
| 15 | `confusable_entries` | list of `{value, explanation}` (word_confusables table) | **AI** | ❌ not in form (preserved via sparse update) | Not available from DICT. Saved via Quick Add enrichment. |
| 16 | `verb_form` | `{past_simple, past_participle, present_participle, third_person}` (word_verb_forms table) | **AI** | ✅ 4 text inputs (verb/phrasal verb only) | All 4 fields editable. `isVerb` check includes "phrasal verb". |
| 17 | `notes` | text, nullable | **AI** | ✅ textarea | Usage notes, common mistakes, register tips. Optional enrichment. |

> **Current coverage**: 15 of 17 enrichable fields are in the edit form. The 2 missing (`pronunciation_audio_url`, `confusable_entries`) are saved via Quick Add enrichment and preserved via sparse update on edit.

## Merge Rules

```
For each field:
  1. If DICT provides a value → use it (higher reliability)
  2. If DICT has no value → use AI value
  3. For list fields (examples, synonyms, antonyms):
     → Combine DICT + AI, deduplicate, cap at target count
  4. For definition:
     → Use DICT definition as primary
     → If AI definition adds meaningful context, append as note
```

## DB Constraint Validation (must enforce before save)

| Field | Validation |
|-------|-----------|
| `part_of_speech` | Must match a row in `parts_of_speech` table by name |
| `cefr_level` | Must be one of: A1, A2, B1, B2, C1, C2 |
| `register` | Must be one of: formal, informal, neutral, slang, technical |
| `countability` | Must be one of: countable, uncountable, both, plural, collective |
| `frequency_rank` | Must be integer ≥ 1 |
| `translation_entries` | Each value must be non-empty string |
| `example_entries` | Each value must be non-empty string |
| `synonym_entries` | Each value must be non-empty string; unique per word |
| `antonym_entries` | Each value must be non-empty string; unique per word |
| `collocation_entries` | Each value must be non-empty string; unique per word |
| `confusable_entries` | Each `value` must be non-empty string; unique per word; `explanation` optional |

## What DICT Returns (example for "resilient")

```
GET https://api.dictionaryapi.dev/api/v2/entries/en/resilient

[{
  "word": "resilient",
  "phonetics": [
    { "text": "/ɹɪˈzɪliənt/", "audio": "https://...mp3" }
  ],
  "meanings": [
    {
      "partOfSpeech": "adjective",
      "definitions": [
        {
          "definition": "Able to recover quickly from illness, change, or misfortune.",
          "example": "The resilient community rebuilt after the flood.",
          "synonyms": ["tough", "hardy", "strong"],
          "antonyms": ["fragile", "weak"]
        }
      ]
    }
  ]
}]
```

Gives us: `pronunciation_ipa`, `pronunciation_audio_url`, `part_of_speech`, `definition`, partial `example_entries`, partial `synonym_entries`, partial `antonym_entries`.

## What AI Prompt Returns (structured JSON)

```json
{
  "definition": "Able to recover quickly from difficulties; showing resilience.",
  "part_of_speech": "adjective",
  "cefr_level": "B2",
  "register": "neutral",
  "countability": null,
  "frequency_rank": 4500,
  "pattern": "be resilient + to/in + noun",
  "translation_entries": ["устойчивый", "стойкий", "упругий"],
  "example_entries": [
    "Children are often more resilient than adults give them credit for.",
    "The company proved resilient during the economic downturn.",
    "You need to be resilient to work in emergency services."
  ],
  "synonym_entries": ["tough", "hardy", "adaptable", "flexible", "durable"],
  "antonym_entries": ["fragile", "vulnerable", "brittle"],
  "collocation_entries": ["highly resilient", "emotionally resilient", "resilient economy", "resilient community"],
  "confusable_entries": [
    { "value": "resistant", "explanation": "'Resistant' means opposing/withstanding; 'resilient' means bouncing back after damage." }
  ],
  "verb_form": null,
  "notes": "Often used in psychology and business contexts. Implies recovery, not just endurance."
}
```
