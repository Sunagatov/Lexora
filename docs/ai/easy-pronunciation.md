# Easy pronunciation

Russian-letter reading hints use `Word.pronunciation_easy` and
`Word.pronunciation_note_ru`. They are approximate, not IPA or verified recordings.
Existing IPA, transliteration/Pinyin and audio remain separate. The list shows a
desktop column only when the page has hints; mobile cards show the term, speaker
button and small hint in one wrapping row, with translations below. The word detail
shows any individual Russian explanation.

The Languages dialog stores a pronunciation display choice per learning language:
Russian reading hints, Mandarin Pinyin, or saved IPA. Only the list presentation
changes; it does not translate, generate or overwrite data. A missing chosen field
stays empty rather than silently showing a different notation. Preferences are
local to the browser and also work with saved offline words. Changing the notation
does not clear query data, reset the current page or change ratings. Word details
continue to show the separately saved representations and Russian guidance.

These are import-only fields in the public API. Responses and offline snapshots
include them. Rating/content edits preserve them; changing the word itself clears
stale hints online and offline. They are excluded from offline conflict comparison
so an older saved copy can still sync edits/deletions after a content import.

## Reviewed Spanish package

`backend/data/pronunciation/es-20261028/` preserves the source package bytes from
the user's [Drive folder](https://drive.google.com/drive/folders/1-f2YkLNc9hcKAvsc-tJ3GRp8spwkJ8U2).
It contains 500 IDs (18861–19360), scheme `russian-cyrillic-v1`, and its guide,
correction report and checksum manifest. The original manifest's approval is false;
it records rule-based/eSpeak review, not individual native-audio verification.
The operator must explicitly review/accept these approximations before applying.
Do not interpret the source's `ready` status as authorization.

## Import

Migration `20261028_0015` adds two nullable text columns. Back up and restore the
production schema into isolated PostgreSQL, rehearse migration/import and check
all existing fields/relationships before touching production. Run from Vault.

Within the backend image:

```sh
python -m app.scripts.import_pronunciations DATA.jsonl MANIFEST.json --report preview.json
python -m app.scripts.import_pronunciations DATA.jsonl MANIFEST.json --report applied.json \
  --apply --reviewed --expected-plan REVIEWED_SHA256
```

The importer supports Spanish, Mandarin, Tatar, Turkish, Arabic, German, French
and Portuguese. It validates
the language-specific notation scheme so a Mandarin Pinyin source file cannot be
mistaken for Russian reading hints. For a partially reviewed package, explicitly
add `--skip-unreviewed` to preview and apply; deferred IDs and reasons appear in
the report. Without that flag, any unresolved row blocks the package.

The importer validates source checksum, schema, unique IDs, count, exact language,
term/POS, active state and existing hints. Any conflict blocks the entire import.
Apply locks the words and recomputes the reviewed plan. Only the two hint columns
change, including preservation of timestamps. Repeat imports are no-ops. The report
contains each changed ID and before/after hint values for scoped recovery; do not
restore a full database over later learning progress. Keep the full backup too.

The source XLSX checksum and all 500 identities were checked locally against the
user's original export before implementation. Linguistic accuracy remains bounded
by the documented approximation scheme; no claim of native-speaker certification.

## Additional reviewed packages

The four `backend/data/pronunciation/{zh,tt,tr,ar}-20261028/` directories preserve
the supplied source files alongside separately reviewed JSONL and manifests.
Each contains 500 stable IDs. The initial import accepted Mandarin 500, Tatar 459,
Turkish 384 and Arabic 361. Its 296 held rows remain in those historical packages;
their later reviewed resolutions are separate, not silent changes to source files.

`backend/data/pronunciation/README.md` records references, methods and limitations.
Mandarin imports the Russian hint sidecar, never overwrites existing Pinyin, and
uses tone numbers. Tatar retains its native Cyrillic letters with stress marks;
Arabic uses approximate Modern Standard Arabic citation readings with vowel
length marks. None of these packages is certified against individual native audio.

For a reviewed multi-package operation, validate live meaning/translation/Pinyin
context as well as exact identity, apply all eligible hints in one transaction,
and compare every protected field/table before and after. Exclude the two hint
columns only for imported IDs from that comparison: held rows and other
languages' existing hints must also stay unchanged. Keep the fresh full backup,
restored rehearsal and per-ID before/after report in the operations repository's
documented recovery location. Existing schema/UI can serve new content without
replacing running application images.

## Completed starter-library coverage

`backend/data/pronunciation/completed-20261028/{de,fr,pt,tt,tr,ar}/` contains six
500-entry packages, exact live identities and checksum manifests. It adds 1,796
previously missing hints: German/French/Portugal Portuguese 500 each, Tatar 41,
Turkish 116 and Arabic 139. The other 1,204 hints in these six libraries are copied
unchanged for a repeatable full-library preview. Spanish and Mandarin remain
separate and protected. No translations, Pinyin, IPA, topics or progress are changed.

The reviewed guides are approximate. Where lexical stress could not be established
or varies, the guide leaves it unmarked with an individual note instead of inventing
an accent (including Tatar Wi-Fi and several Turkish loans). French and Portuguese
use `~` for a nasal vowel/diphthong, not an extra consonant n/m. Arabic phrases are
explicitly segmented teaching/citation forms unless a connected form is documented;
case endings and joins can differ in actual speech. Full formal -iyy is distinguished
from reduced spoken -ī. None of the entries claims individual native-audio verification.

The package review summaries and decision records list primary references and the
limits of each notation. Completion means every starter entry has a useful reading
aid, not that every accent or phonetic detail has been certified by a native speaker.
