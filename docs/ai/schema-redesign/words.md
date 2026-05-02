# words

**Status:** MODIFIED (major changes — new columns, dropped columns, new constraints)

## Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Primary key |
| `term` | `VARCHAR(255)` | NO | — | The word or phrase |
| `language` | `VARCHAR(2)` | NO | `'en'` | Term language: `en` or `ru` |
| `definition` | `TEXT` | YES | `NULL` | English-to-English definition (for `en` words) or Russian definition (for `ru` words) |
| `pronunciation_ipa` | `VARCHAR(255)` | YES | `NULL` | IPA transcription, e.g. `/ˈæn.ɪ.məl/` |
| `pronunciation_audio_url` | `VARCHAR(512)` | YES | `NULL` | URL to pronunciation audio clip |
| `image_url` | `VARCHAR(512)` | YES | `NULL` | URL to visual association image |
| `part_of_speech_id` | `INT` | YES | `NULL` | FK → `parts_of_speech(id)` |
| `cefr_level` | `VARCHAR(2)` | YES | `NULL` | CEFR proficiency level |
| `register` | `VARCHAR(20)` | YES | `NULL` | Formality register |
| `countability` | `VARCHAR(20)` | YES | `NULL` | Noun countability |
| `frequency_rank` | `INT` | YES | `NULL` | Word frequency rank (1 = most common) |
| `knowledge_level` | `INT` | YES | `NULL` | User's self-assessed knowledge (1–5) |
| `pattern` | `TEXT` | YES | `NULL` | Usage pattern notes |
| `notes` | `TEXT` | YES | `NULL` | Free-form notes |
| `is_active` | `BOOLEAN` | NO | `true` | Soft-active flag |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last modification timestamp |
| `deleted_at` | `TIMESTAMPTZ` | YES | `NULL` | Soft-delete timestamp |
| `deleted_via_topic_id` | `INT` | YES | `NULL` | FK → `topics(id)`, tracks which topic deletion caused this word's soft-delete |

## Constraints

| Name | Type | Definition |
|------|------|------------|
| `words_pkey` | PRIMARY KEY | `(id)` |
| `uq_words_term_pos_lang` | UNIQUE | `(term, part_of_speech_id, language)` |
| `fk_words_pos` | FOREIGN KEY | `part_of_speech_id → parts_of_speech(id)` |
| `fk_words_deleted_via_topic` | FOREIGN KEY | `deleted_via_topic_id → topics(id) ON DELETE SET NULL` |
| `ck_words_language` | CHECK | `language IN ('en', 'ru')` |
| `ck_words_cefr_level` | CHECK | `cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')` |
| `ck_words_register` | CHECK | `register IN ('formal', 'informal', 'neutral', 'slang', 'technical')` |
| `ck_words_countability` | CHECK | `countability IN ('countable', 'uncountable', 'both', 'plural', 'collective')` |
| `ck_words_knowledge_level` | CHECK | `knowledge_level BETWEEN 1 AND 5` |
| `ck_words_frequency_rank` | CHECK | `frequency_rank >= 1` |

## Indexes

| Name | Columns | Unique | Notes |
|------|---------|--------|-------|
| `ix_words_term` | `term` | NO | Term search |
| `ix_words_language` | `language` | NO | Language filtering |
| `ix_words_deleted_at` | `deleted_at` | NO | Soft-delete filtering |
| `ix_words_deleted_via_topic_id` | `deleted_via_topic_id` | NO | FK lookup |
| `uq_words_term_pos_lang` | `(term, part_of_speech_id, language)` | YES | Prevents duplicate entries |

## Relationships

- `part_of_speech_id → parts_of_speech(id)` — many words to one POS.
- `deleted_via_topic_id → topics(id)` — soft-delete provenance.
- `word_topics` junction table — many-to-many with topics.
- `word_verb_forms` — 1:1 (verb forms, only for verbs).
- `word_translations` — 1:N ordered entries.
- `word_examples` — 1:N ordered entries.
- `word_synonyms` — 1:N ordered entries.
- `word_antonyms` — 1:N ordered entries.
- `word_collocations` — 1:N ordered entries.
- `word_confusables` — 1:N ordered entries.
- `word_progress_events` — 1:N progress history.
- `study_queue_items` — 1:N queue membership.

## Dropped Columns (from current schema)

| Column | Reason |
|--------|--------|
| `translations` (TEXT) | Replaced by `word_translations` structured entries. Single source of truth. |
| `example` (TEXT) | Replaced by `word_examples` structured entries. Single source of truth. |
| `past_simple` (VARCHAR) | Moved to `word_verb_forms` table. Only applies to verbs. |
| `past_participle` (VARCHAR) | Moved to `word_verb_forms` table. Only applies to verbs. |

## New Columns (not in current schema)

| Column | Rationale |
|--------|-----------|
| `language` | Bidirectional learning: `en` words have Russian translations, `ru` words have English translations. |
| `definition` | English-to-English definition shifts learning from translation-based to immersion-based. |
| `pronunciation_ipa` | Critical for self-study pronunciation. Can be auto-populated from dictionary APIs. |
| `pronunciation_audio_url` | Audio pronunciation link. Many free sources available. |
| `image_url` | Visual memory anchor, especially for concrete nouns. |
| `cefr_level` | Enables difficulty-based study filtering and progression. |
| `register` | Knowing when to use a word (formal vs slang) matters as much as knowing its meaning. |
| `frequency_rank` | Prioritize learning common words first in study sessions. |

## Design Notes

- **UNIQUE(term, part_of_speech_id, language)** — "run" as a noun and "run" as a verb are different entries. "cat" (en) and "cat" (ru-borrowed) are different entries. Two "run" nouns in the same language are a data error.
- **Replaces `uq_words_normalized_term`** — The current global uniqueness index on normalized term is replaced by the composite unique constraint. The new constraint is more precise: it allows the same term with different POS or language.
- **`language` CHECK, not a lookup table** — Only two values (`en`, `ru`). A lookup table would be overengineering for a personal app.
- **`cefr_level` CHECK, not a lookup table** — Exactly 6 values that will never change. CHECK is simpler.
- **`register` CHECK, not a lookup table** — Small fixed set (5 values). CHECK is sufficient.
- **`countability` values are lowercase-normalized** — The current schema has mixed case ("Countable" vs "countable"). The new schema enforces lowercase via CHECK.
- **`part_of_speech_id` is nullable** — Some entries (especially during quick-add) may not have POS assigned yet.
- **`cefr_level` is nullable** — Only meaningful for `language='en'` words. Russian words don't have CEFR levels.
- **Translations are implicitly in the other language** — If `language='en'`, `word_translations` entries are Russian. If `language='ru'`, they are English. No explicit `translation_language` column needed.
