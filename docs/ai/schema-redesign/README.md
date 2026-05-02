# Schema Redesign — New Database Design

This directory contains the complete specification for the Lexora database redesign. Each file describes one table: its columns, types, constraints, indexes, relationships, and design rationale.

## Design Goals

1. **Normalized references** — `part_of_speech` moves from free text to a lookup table (`parts_of_speech`). CEFR, register, and countability use CHECK constraints (small fixed value sets).
2. **Bidirectional learning** — A `language` column on `words` (`en` / `ru`) supports English→Russian and Russian→English study from the same schema.
3. **Single source of truth** — Flat `translations` and `example` text columns are dropped. Only the structured entry tables (`word_translations`, `word_examples`) remain.
4. **Verb forms separated** — `past_simple`, `past_participle` move out of `words` into a dedicated `word_verb_forms` 1:1 table, with new `present_participle` and `third_person` columns.
5. **New enrichment tables** — `word_synonyms`, `word_antonyms`, `word_collocations`, `word_confusables` follow the same ordered-entry pattern as translations/examples.
6. **New word attributes** — `definition`, `pronunciation_ipa`, `pronunciation_audio_url`, `image_url`, `cefr_level`, `register`, `frequency_rank`.
7. **Proper constraints** — CHECK constraints on `knowledge_level`, `cefr_level`, `register`, `countability`, `frequency_rank`, `language`. UNIQUE constraints where data integrity requires them.
8. **No overengineering** — No `languages` table, no `word_meanings` multi-definition table, no generic `word_relationships` graph, no closure table for topic hierarchy.

## Table Index

| # | Table | File | Status |
|--:|-------|------|--------|
| 1 | `parts_of_speech` | [parts_of_speech.md](parts_of_speech.md) | NEW |
| 2 | `topics` | [topics.md](topics.md) | MODIFIED |
| 3 | `words` | [words.md](words.md) | MODIFIED |
| 4 | `word_verb_forms` | [word_verb_forms.md](word_verb_forms.md) | NEW |
| 5 | `word_translations` | [word_translations.md](word_translations.md) | MODIFIED |
| 6 | `word_examples` | [word_examples.md](word_examples.md) | MODIFIED |
| 7 | `word_synonyms` | [word_synonyms.md](word_synonyms.md) | NEW |
| 8 | `word_antonyms` | [word_antonyms.md](word_antonyms.md) | NEW |
| 9 | `word_collocations` | [word_collocations.md](word_collocations.md) | NEW |
| 10 | `word_confusables` | [word_confusables.md](word_confusables.md) | NEW |
| 11 | `word_topics` | [word_topics.md](word_topics.md) | UNCHANGED |
| 12 | `word_progress_events` | [word_progress_events.md](word_progress_events.md) | MODIFIED |
| 13 | `study_queues` | [study_queues.md](study_queues.md) | UNCHANGED |
| 14 | `study_queue_items` | [study_queue_items.md](study_queue_items.md) | UNCHANGED |
| 15 | `app_usage_events` | [app_usage_events.md](app_usage_events.md) | UNCHANGED |

See [migration-plan.md](migration-plan.md) for a summary of all changes from the current schema to the new one.

## Entity Relationship Overview

```
parts_of_speech ──1:N──► words ◄──N:1── topics (via word_topics)
                           │
                           ├──1:1──► word_verb_forms
                           ├──1:N──► word_translations
                           ├──1:N──► word_examples
                           ├──1:N──► word_synonyms
                           ├──1:N──► word_antonyms
                           ├──1:N──► word_collocations
                           ├──1:N──► word_confusables
                           ├──1:N──► word_progress_events
                           └──1:N──► study_queue_items ──N:1──► study_queues

topics ──self-ref──► topics (parent_topic_id)
```
