# Migration Plan — Current Schema → New Schema

## Overview

This migration transforms the Lexora database from its current shape into the redesigned schema. Since the database was recently emptied (only Animals topic tree with ~148 words remains), this is a clean-slate opportunity.

## Strategy

**Recommended approach:** Single Alembic migration that drops and recreates the affected tables. The small amount of remaining data (Animals words) can be re-imported after migration via the existing bulk import or AI curation pipeline.

**Alternative approach:** Incremental migration that preserves existing data. More complex but avoids re-import. Only worth it if the Animals data is hard to recreate.

## Changes Summary

### New Tables

| Table | Purpose |
|-------|---------|
| `parts_of_speech` | Lookup table replacing free-text POS on words |
| `word_verb_forms` | 1:1 verb conjugation forms (extracted from words) |
| `word_synonyms` | Ordered synonym entries with optional word linking |
| `word_antonyms` | Ordered antonym entries with optional word linking |
| `word_collocations` | Ordered collocation phrases |
| `word_confusables` | Ordered confusable words with explanations |

### Modified Tables

#### `topics`
- ADD: UNIQUE constraint on `name`
- ADD: CHECK constraint `id != parent_topic_id`

#### `words`
- ADD columns: `language`, `definition`, `pronunciation_ipa`, `pronunciation_audio_url`, `image_url`, `cefr_level`, `register`, `frequency_rank`
- ADD: `part_of_speech_id` FK → `parts_of_speech(id)` (replaces `part_of_speech` text)
- ADD: UNIQUE constraint `(term, part_of_speech_id, language)`
- ADD: CHECK constraints on `language`, `cefr_level`, `register`, `countability`, `knowledge_level`, `frequency_rank`
- DROP columns: `translations`, `example`, `past_simple`, `past_participle`, `part_of_speech`
- DROP: `uq_words_normalized_term` index (replaced by composite unique)

#### `word_translations`
- ADD: CHECK `position >= 0`
- ADD: CHECK `value != ''`

#### `word_examples`
- ADD: CHECK `position >= 0`
- ADD: CHECK `value != ''`

#### `word_progress_events`
- ADD: CHECK `old_level BETWEEN 1 AND 5`
- ADD: CHECK `new_level BETWEEN 1 AND 5`
- ADD: CHECK `source IN (...)` for known progress sources

### Unchanged Tables

- `word_topics`
- `study_queues`
- `study_queue_items`
- `app_usage_events`

## Migration Steps (Clean-Slate Approach)

1. **Create `parts_of_speech` table** and seed with initial values (noun, verb, adjective, adverb, phrase, preposition, phrasal verb, other).

2. **Alter `topics`:**
   - Add UNIQUE constraint on `name`.
   - Add CHECK constraint `id != parent_topic_id`.

3. **Alter `words`:**
   - Add new columns: `language` (NOT NULL DEFAULT 'en'), `definition`, `pronunciation_ipa`, `pronunciation_audio_url`, `image_url`, `part_of_speech_id`, `cefr_level`, `register`, `frequency_rank`.
   - Migrate existing `part_of_speech` text values to `part_of_speech_id` FK references.
   - Migrate existing `past_simple`/`past_participle` to new `word_verb_forms` table.
   - Migrate existing `translations` text to `word_translations` entries (if not already present).
   - Migrate existing `example` text to `word_examples` entries (if not already present).
   - Drop columns: `translations`, `example`, `past_simple`, `past_participle`, `part_of_speech`.
   - Drop `uq_words_normalized_term` index.
   - Lowercase-normalize existing `countability` values.
   - Add all CHECK constraints.
   - Add UNIQUE constraint `(term, part_of_speech_id, language)`.

4. **Create `word_verb_forms` table.**

5. **Create `word_synonyms`, `word_antonyms`, `word_collocations`, `word_confusables` tables.**

6. **Alter `word_translations`:** Add CHECK constraints.

7. **Alter `word_examples`:** Add CHECK constraints.

8. **Alter `word_progress_events`:** Add CHECK constraints.

## Application Code Changes Required

### Backend Model Layer
- New model: `PartsOfSpeech` in a shared or words feature module.
- New model: `WordVerbForm` (1:1 relationship with Word).
- New models: `WordSynonym`, `WordAntonym`, `WordCollocation`, `WordConfusable`.
- Update `Word` model: remove dropped columns, add new columns and relationships.
- Update `WordTranslation` / `WordExample`: no model changes needed (CHECK constraints are DB-level).

### Backend Schemas (Pydantic)
- `WordCreate` / `WordUpdate` / `WordResponse`: add new fields, remove `translations` (flat), `example` (flat), `past_simple`, `past_participle`. Add `language`, `definition`, `pronunciation_ipa`, etc.
- `WordInput` (bulk import): same changes.
- New schemas for verb forms, synonyms, antonyms, collocations, confusables.
- AI curation import/export schemas: update to match new word shape.
- AI review schemas: update to match new word shape.

### Backend Repository Layer
- `create_word` / `update_word`: handle new fields, verb forms table, new entry tables.
- Remove all `translations` / `example` flat-field read/write logic.
- Remove `multivalue.py` sync logic for flat ↔ structured field reconciliation.
- Add `language` filter to word queries.

### Backend Service Layer
- Enrichment logic: update to use `word_examples` only (no flat `example` fallback).
- Workbook import/export: update column mappings.
- AI curation: update export/import word shapes.
- Bulk import: update word creation to include new fields.

### Frontend
- Update `wordTypes.ts` with new fields.
- Update word display components to show new attributes.
- Update word edit form to support new fields.
- Update quick-add flow if language selection is needed.

## Rollback Plan

If the migration fails or needs to be reverted:
- Alembic `downgrade` reverses all changes.
- The clean-slate approach means data loss is limited to whatever was imported after migration.
- Keep a pg_dump backup before running the migration.
