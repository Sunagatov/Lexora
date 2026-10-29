# Multilingual vocabulary

## Supported libraries

The language catalog lives in backend `features/languages/catalog.py` and frontend
`features/languages/api.ts`. The picker lists English plus Mandarin Chinese,
Spanish, German, Turkish, Tatar, Arabic, French and Portuguese. This is a fixed
catalog, not a user-managed language creation feature. Legacy Russian learning
records remain accepted by the API but Russian is primarily a translation language.

Defaults: Simplified Mandarin (`zh-CN`), Spain Spanish (`es-ES`), Germany German
(`de-DE`), Turkey Turkish (`tr-TR`), Cyrillic Tatar (`tt-RU`), Modern Standard Arabic
(`ar-SA`), France French (`fr-FR`), Portugal Portuguese (`pt-PT`), English (`en-GB`).
These choose AI prompt and browser speech defaults, not dialect conversion of
existing text. Speech depends on available browser/device voices; Tatar in
particular may lack a suitable installed voice.

## Context and data

`get_db` validates the two language headers and stores context in `Session.info`.
Repositories/services explicitly scope vocabulary, topic trees, duplicates,
statistics, usage and review queues. Slug uniqueness includes learning language;
native-script topic names are supported. The same spelling can exist independently
in two learning libraries, and refreshing one Daily Mix leaves other queues active.

Word IDs stay global. Existing topics, queues and usage are migrated as English.
New libraries start empty: this feature does not populate dictionaries or translate
the existing English library into eight languages.

Russian translations remain the default and legacy entry fields. Translations are
stored per `word_id/language/position`. English definition/notes live in optional
`Word.explanation_groups`; the original scalar fields remain the default content.
Responses expose both groups. The frontend chooses the saved target group without
mutating the snapshot. Missing English content displays empty rather than being
labelled Russian-as-English. Existing historical definitions keep their original
language; migration does not linguistically rewrite them. Examples and lexical
relations remain shared word content, retaining their saved text.

Mandarin pinyin and other romanisation can use `transliteration`; Mandarin, Arabic
and Tatar editors expose it. Search includes transliteration. Native Arabic terms
use isolated RTL text without changing the surrounding interface direction.
Pronunciation uses the word's learning locale. English verb-form fields are only
shown for English; other grammar belongs in pattern/notes. CEFR remains optional;
HSK and language-specific proficiency scales are not introduced here.

Mandarin search also accepts Pinyin without tone marks or spaces (`ni hao`,
`nihao`), numbered input (`ni3hao3`), and `v`/`u:` for `ü`. Saved Pinyin is not
rewritten. Both server search and topic-list filtering use these reading keys.
Renaming a word clears its old pronunciation hints, Pinyin, IPA and audio unless
a different replacement is supplied in the same update. Other edits preserve them.

## Frontend and offline

Preferences persist for the last-used setup, while already-open tabs keep their
own selected language. Library changes clear QueryClient and remount scoped views,
then navigate to All words. Translation-only changes retain the route. Switching
is disabled while a mutation is pending or a word edit form is open.

History entries remember their learning library, so browser Back/Forward restores
the library as well as the word/topic route. Missing word pages link to All words.

The browser-tab favicon follows the selected learning language and its saved
preference on reload. It uses local flag PNGs rendered from the bundled Noto
font, including offline; translation-only changes do not change the icon.

The current client opts into complete snapshots using `X-Lexora-All-Languages: true`;
older clients receive their selected library only. Complete snapshots retain every language and translation group. Local list/topic/
summary/Trash reads scope to the selected library. Daily Mix copies are keyed by
language; old English `replica.mix` copies migrate lazily to `mixes.en`. Queued edits
use their own entity language for sync, so switching the UI does not misroute them.
UsageTracker retains its mounted language when flushing on a language switch.

Reload existing open Lexora tabs after upgrading so all tabs use the new scoping
code. An older frontend does not understand multilingual offline snapshots.

## Imports and enrichment

Website workbook exports contain a hidden `_Lexora_Language` sheet. Preview rejects
a different learning or translation language; previews, apply retries and recovery
records bind that context. Imports update only the selected translations and
definition/notes and preserve other groups, Word IDs, ratings and topic links.
Older workbooks without language metadata use the import dialog's selected context.

The add-only JSON bulk API also scopes topic creation and defaults words to the
request language. Explicit cross-language word payloads are rejected. Entry-level
`translation_language` is optional and defaults to the request target language.

Legacy AI-review and AI-curation formats retain Russian translations; their English
content mode is rejected instead of overwriting Russian. Their topic scope follows
the selected library. The older operator workbook synchronisation/recovery tool
remains English-library/Russian-content only, preserving any extra English group.

AI enrichment requests carry both languages; English dictionary lookup runs only
for English. Prompts request source-language vocabulary, target-language notes and
definitions, bilingual examples, and pinyin where applicable. They request four
natural equivalents where available and prohibit filler. They do not force English
verb forms onto other languages. Automated tests use mocked providers, not live calls.

## Migration

`20261027_0013` follows `20261014_0010`. It preserves existing rows and IDs, adds
language scopes and translation groups, extends the Word language check and adds
transliteration/explanation storage. A downgrade refuses once multilingual or new
annotation data exists; use a verified pre-migration backup for that case.
Production backup/restore and deployment remain operational work outside this repo.
