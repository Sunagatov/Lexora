# ChatGPT Word Generation Prompt

Use this prompt to ask ChatGPT to generate vocabulary words for bulk import into Lexora. Replace the topic name and subtopics for each new topic.

---

I need you to generate English vocabulary words for a language learning app. The parent topic is **"Food & Drink"** with 10 subtopics. Generate **60 words per subtopic** (600 words total).

## Subtopics

| # | Subtopic | Words |
|--:|----------|------:|
| 1 | Fruits | 60 |
| 2 | Vegetables | 60 |
| 3 | Meat | 60 |
| 4 | Seafood | 60 |
| 5 | Dairy | 60 |
| 6 | Grains | 60 |
| 7 | Desserts | 60 |
| 8 | Drinks | 60 |
| 9 | Meals | 60 |
| 10 | Cooking | 60 |

For each subtopic, include a mix of nouns, verbs, adjectives, and phrases relevant to that subtopic. Cooking should include verbs (bake, fry, grill…), nouns (oven, spatula…), and adjectives (raw, crispy…).

## Output format

**JSON Lines (JSONL)** — one JSON object per line. No markdown fences, no commentary, no blank lines. Each line must be a valid JSON object.

**Provide the result as a single downloadable `.jsonl` file.**

## Fields for each object

Every object must have exactly these fields:

| Field | Type | Description |
|-------|------|-------------|
| `topic_name` | string | The subtopic name exactly as listed above (e.g. "Fruits", "Cooking") |
| `term` | string | The English word or phrase, lowercase unless proper noun, max 255 chars |
| `language` | string | Always `"en"` |
| `definition` | string | One clear English definition sentence |
| `part_of_speech` | string | **ONLY** one of: `noun`, `verb`, `adjective`, `adverb`, `phrase`, `preposition`, `phrasal verb`, `other` |
| `translation_entries` | array of strings | 1–3 Russian translations, most common first |
| `example_entries` | array of strings | Exactly 2 natural example sentences using the word |
| `countability` | string or null | **For nouns ONLY**: one of `"countable"`, `"uncountable"`, `"both"`, `"plural"`, `"collective"`. **Must be `null` for all non-nouns** |
| `cefr_level` | string | **ONLY** one of: `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| `register` | string | **ONLY** one of: `formal`, `informal`, `neutral`, `slang`, `technical` |
| `pattern` | string or null | Grammatical pattern if relevant (e.g. `"to chop sth"`, `"a slice of sth"`), or `null` |
| `pronunciation_ipa` | string | IPA transcription in British English (e.g. `"/ˈæp.əl/"`) |
| `notes` | string or null | Short usage note (British vs American, common confusion, etc.) or `null` |
| `verb_form` | object or null | **For verbs and phrasal verbs ONLY**: `{"past_simple":"...","past_participle":"...","present_participle":"...","third_person":"..."}`. **Must be `null` for all non-verbs** |

## Strict constraints

1. **`part_of_speech`** — ONLY these exact values: `noun`, `verb`, `adjective`, `adverb`, `phrase`, `preposition`, `phrasal verb`, `other`. No other values. No "pronoun", "conjunction", "interjection", "determiner".
2. **`countability`** — ONLY `"countable"`, `"uncountable"`, `"both"`, `"plural"`, `"collective"` for nouns. MUST be `null` for non-nouns.
3. **`cefr_level`** — ONLY `A1`, `A2`, `B1`, `B2`, `C1`, `C2`. Distribute realistically: mostly A1–B2 for food vocabulary, C1–C2 only for rare/technical terms.
4. **`register`** — ONLY `formal`, `informal`, `neutral`, `slang`, `technical`. Most food words are `neutral`.
5. **`verb_form`** — required for every word where `part_of_speech` is `"verb"` or `"phrasal verb"`. All 4 sub-fields (`past_simple`, `past_participle`, `present_participle`, `third_person`) must be present. Must be `null` for non-verbs.
6. **`translation_entries`** — Russian translations. Most common translation first. For food items with no direct Russian equivalent, transliterate and explain.
7. **`example_entries`** — exactly 2 sentences per word. Natural, varied, demonstrating the word's meaning clearly.
8. **`pronunciation_ipa`** — standard British English IPA.
9. **No duplicates** across subtopics. If a word fits multiple subtopics, place it in the most specific one.
10. **Do NOT include** these fields: `synonym_entries`, `antonym_entries`, `collocation_entries`, `confusable_entries`, `frequency_rank`, `image_url`, `pronunciation_audio_url`, `knowledge_level`. They will be added later.
11. **`null` must be JSON null**, not the string `"null"`.

## Example lines

```
{"topic_name":"Fruits","term":"apple","language":"en","definition":"A round fruit with red, green, or yellow skin and firm white flesh.","part_of_speech":"noun","translation_entries":["яблоко"],"example_entries":["I packed an apple in my lunch bag.","These apples are perfect for making pie."],"countability":"countable","cefr_level":"A1","register":"neutral","pattern":null,"pronunciation_ipa":"/ˈæp.əl/","notes":null,"verb_form":null}
{"topic_name":"Cooking","term":"simmer","language":"en","definition":"To cook food gently in liquid just below boiling point.","part_of_speech":"verb","translation_entries":["тушить","варить на медленном огне"],"example_entries":["Let the sauce simmer for twenty minutes.","She simmered the soup until the vegetables were tender."],"countability":null,"cefr_level":"B2","register":"neutral","pattern":"to simmer sth","pronunciation_ipa":"/ˈsɪm.ər/","notes":"Often confused with 'boil' — simmering has smaller, gentler bubbles.","verb_form":{"past_simple":"simmered","past_participle":"simmered","present_participle":"simmering","third_person":"simmers"}}
```

Generate all 600 words and provide the complete result as a **downloadable `.jsonl` file**. No other text in the file — only the JSONL lines.
