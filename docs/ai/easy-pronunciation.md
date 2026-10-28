# Easy pronunciation

Russian-letter reading hints use `Word.pronunciation_easy` and
`Word.pronunciation_note_ru`. They are approximate, not IPA or verified recordings.
Existing IPA, transliteration/Pinyin and audio remain separate. The list shows a
desktop column only when the page has hints; mobile cards show the term, speaker
button and small hint in one wrapping row, with translations below. The word detail
shows any individual Russian explanation.

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

The importer supports Spanish, Mandarin, Tatar, Turkish and Arabic. It validates
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
Each contains 500 stable IDs. Eligible readings: Mandarin 500, Tatar 459,
Turkish 384 and Arabic 361. The remaining 296 rows retain `needs_review`, a reason
and a null hint; do not silently import their draft proposals.

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
