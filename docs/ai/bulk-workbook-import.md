# Reviewed workbook imports

The website uses Upload → Preview → Apply → Result. Preview does not change words,
topics or learning data. Valid previews save an import record; invalid files
return all row errors without creating an applicable batch.

## Workbook format

The sidebar Export action downloads one row per Word ID. The import dialog offers
a blank template with current topic references. Existing topic-per-sheet exports
and their `__lexora_meta` IDs remain accepted.

- `Words`: existing export columns plus `Topic IDs` and `Topics`. Separate
  translations, examples and topic references with newlines. Semicolons also
  separate translations/topic references; commas can be part of a topic name.
- Flat and topic exports also include `Pinyin / transliteration`,
  `Pronunciation (IPA)`, `Russian reading hint`, `Pronunciation note (RU)` and
  `Pronunciation audio URL`. Reviewed content imports preserve blank/omitted
  pronunciation cells, show changed readings in the preview/recovery record,
  and invalidate an unchanged old reading when its word is renamed. Preview again
  after upgrading: previews created before these fields were supported are stale.
- Separate example blocks with blank lines, retaining the native/RU/EN lines
  inside each block. Older single-line and EN/RU formats remain accepted.
- `Topics`: `Topic ID`, `Topic`, `Parent ID`, `Description`. Existing IDs/names are
  references only. A referenced new name with a blank ID creates a topic. Parent
  ID must be an existing active topic. Imports do not rename, reparent or delete
  existing topics.
- Limits: 10 MB, 50,000 worksheet rows, 50 columns per visible sheet. Formula cells
  and duplicate recognized headers are rejected. Flat exports emit vocabulary as
  text, including strings beginning with `=`.

Stable Word IDs confirm updates. Blank IDs match normalized English spelling and
explicit POS. Noun/verb entries stay separate. Multiple senses, deleted matches
or different translations/definitions without an ID require review. Repeated
identical rows combine topic memberships; conflicting nonempty values are errors.

## Modes and validation

- `add` (default): add new words and missing topic links; preserve existing content.
- `content`: also update nonempty content cells. Blank cells and omitted columns
  preserve data. Use the word editor for intentional field clearing.
- Both preserve learning progress, queues, IDs and unrelated metadata. New words
  start at Weak. Exported Knowledge cells are validated but never applied.
- Warnings flag fewer than the requested translations (default four, configurable
  0–20) or three examples. These do not certify linguistic quality or justify
  invented filler. UI acknowledgement is required; errors block the whole batch.
  Every issue can be downloaded as CSV and the full preview as JSON.

## Apply, retries and recovery

`WorkbookImportBatch` stores parsed input, the reviewed before/after plan and its
hash. Apply requires its UUID/hash, rechecks current content under row locks and
returns 409 for stale plans. New learning activity alone does not stale a content
preview. PostgreSQL advisory locking coordinates identity checks with word
creates/updates and JSON bulk writes.

Vocabulary and its result receipt commit together. Retrying the same UUID/hash
returns the receipt with `replayed: true`. Re-uploading unchanged data reports zero
changed words. Counts represent distinct entries, not worksheet occurrences.

Completed receipts provide a checksummed recovery record with prior content and
created word/topic IDs. This is an operator recovery aid, not a complete database
backup or automatic Undo. Reconcile later edits before recovery. Pending previews
expire after one day; pending records older than seven days are removed when
another valid preview is stored. Completed receipts remain available.

XLSX parsing/planning run off the API event loop. Matching indexes and relevant
relationships load in batches; no extra worker service is required.

## Release and compatibility

Migration `20261014_0010` creates only `workbook_import_batches`. Apply it before
releasing the paired backend/frontend changes. Production operations belong in
Vault; source tests never authorize a production import.

The old immediate `POST /api/words/import/xlsx` now returns 409 requiring preview
and apply. Explicit programmatic `import_words_workbook` callers use the same safe
planner, preserving progress/blanks. The operator content synchronization command
retains its separate reviewed-hash, protected-data and recovery contracts.

Tests: `backend/tests/features/test_crud_workbook_flow.py` and
`frontend/src/features/words/__tests__/WorkbookImportDialog.test.tsx`. Coverage
includes 7,000 new words, POS distinctions, shared topics, stale previews, safe
retries, rollback after a mid-apply failure, progress preservation, malformed rows,
flat round trips and the receipt-table migration in a disposable database.
