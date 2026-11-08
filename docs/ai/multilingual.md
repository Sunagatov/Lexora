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

Learning and translation selectors live only in My Lexora → Languages. Owner
preferences sync through `/api/preferences` at login/startup and on focus/reconnect;
shared list defaults apply across learning libraries. Focus refresh pauses during
an open word editor or save so a remote language change cannot discard work.
Overlapping refreshes keep the newest response. Failed reads retain device
settings and expose Retry settings; that action also retries pending saves.
Library changes clear QueryClient and remount scoped views. Returning to words
after selecting a different learning language opens All words in that library.
Switching is disabled while a mutation is pending; the account entry is disabled
while a word editor is open.

History entries remember their learning library, so browser Back/Forward restores
the library as well as the word/topic route and updates the synced language choice.
Missing word pages link to All words. Header branding and the favicon reflect the
selected learning language, without providing another language picker.

Favorites is one list per learning language, independent of topics and knowledge.
Mobile cards keep audio and Favorites at the top-right, pronunciation below the
term, and separate CEFR/part-of-speech badges in the footer beside the rating.
All translations and pronunciation hints wrap in full, without a disclosure arrow.
Audio, Favorites, rating and word actions are siblings of the word link, so they
never open the detail page. Word actions provide editing (including topics), copy,
and a confirmed move to Trash. A failed deletion leaves cached words intact.
The mobile list omits the redundant table column headings. Desktop rows retain
their existing full translations and details expansion.

Vocabulary search is always visible in the toolbar beside sorting and Filters.
It does not autofocus on page load; clearing the query keeps focus in the input.
Desktop search, sorting and Filters are grouped together with small gaps; search
widens modestly on focus instead of leaving a wide reserved track. On mobile it occupies the
controls row until Done, Escape or blur, preserving the query and list position.
Daily Word Mix uses an All words / Daily Word Mix breadcrumb, a matching count,
and New set in its heading row. Only the knowledge distribution bar is shown;
session completion still updates as words are rated, without a separate Reviewed bar.
Collection headings show only the matching word count, without an unfiltered
"of N" suffix. Search and sort/filter controls share the same resting border colour.
The desktop sidebar collapse/expand button sits beside topic search in the header,
including when collapsed. The application footer does not repeat the Lexora brand.
Knowledge choices open a large mobile bottom sheet or an anchored desktop dialog,
with descriptions and a selected checkmark. Selecting saves immediately; dismissing
does not change a rating. Only the active mobile/desktop list presentation mounts.
Desktop tables own their sticky column headers. Narrow desktop content places the
pronunciation under the term, leaving room for translations and stable actions.

On mobile, the full word reading page scrolls the hero together with its details
so long terms/translations cannot pin most of the viewport. The application
header and previous/next navigation remain available; desktop and editing keep
their existing scrolling layout.

Hearts appear on cards, rows and word details. Daily Mix, Favorites and My Lexora
share one sidebar shortcut row, with topic search always visible underneath.
The Topics heading includes sorting and creation; topic search can be cleared
without closing the sidebar. The account shortcut is absent from the app header.
Removing a heart patches only that flag and keeps the current list page
in place until navigation or filter changes. Lists reuse normal sorting, search,
filters and pagination. Offline copies retain the flag and use the same filters.

My Lexora also owns Statistics, Import/Export, Trash, Offline, study defaults and
appearance. Daily Word Mix settings live at `/account/word-mix`, shared across
languages and devices. Size, included knowledge/CEFR levels, recent-review cooldown
and topic balancing affect the next generated set. All topics in the current
language are eligible. A custom size accepts whole numbers 1–1000, alongside
50/100/200/500 presets. Existing generation defaults remain until customised.
Desktop uses centred, width-constrained section navigation; mobile uses an overview and section
pages. Returning to the same library restores the captured word-list URL/scroll.
The header brand and a second click on the sidebar's My Lexora shortcut return
to the captured list; switching a learning
language opens All words for the new library instead. The account header includes
the sidebar burger on all screen sizes, without a duplicate Back to words action.
Mobile account subsections retain navigation to the account overview. Open sidebars
make underlying content inert and return focus when dismissed.
Failed sign-out requests show an account error and retain the session/cache until
sign-out succeeds. Statistics load failures offer Retry within the account.
Expired-session errors from settings reads/saves follow the shared login redirect;
older refresh failures cannot override a newer successful settings refresh.
The account's topic drawer shows loading/error states with Retry and preserves
cached topics on refresh failure, rather than claiming the library is empty.
Statistics counters respect the Animations setting. An unfinished custom mix size
survives a settings refresh; Escape restores the latest saved size. Topic exports
show parent paths and use only still-visible selections after a topic refresh.
Mobile export selectors use full-width rows so their labels stay readable.
Offline copies remain device-local even though display/study preferences sync.
Saved-mode new sets use the cached mix size, knowledge/CEFR choices and topic
balancing. Cooldowns use available saved review history, including completed
items from downloaded sets; they cannot see server history that was not downloaded.

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
