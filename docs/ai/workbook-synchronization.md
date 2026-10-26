# Content-only workbook synchronization

Use `app.scripts.sync_vocabulary_workbook` for linguistic updates to an exported
workbook. The website uses the separate [reviewed bulk import](bulk-workbook-import.md)
flow for new words and content updates. Both website modes protect learning progress.

The operator command defaults to a PostgreSQL read-only transaction and writes a
JSON report. It refuses an implicit SQLite fallback. Configure the target through
the existing application environment; never put credentials in command arguments.
Production execution and recovery belong in Vault, with explicit user approval.

## Contract

- Match positive Word IDs and exported topic IDs in `__lexora_meta`. Unknown or
  deleted references are errors. No words or topics are created or deleted.
- Reconcile all occurrences before touching the database. Different non-empty
  scalar, translation, or example variants are reported with sheet/row locations.
  No variant is chosen implicitly. A resolutions JSON maps Word ID strings to
  field names and explicitly selected observed values.
- Blank cells preserve current data. Non-empty translations replace the ordered
  translation list, with duplicates removed. Labelled EN/RU lines remain one
  `WordExample.value` per pair; plain English examples may coexist in the same
  cell. Existing English examples absent from the workbook
  remain appended; matching English sentences gain the supplied Russian version.
- Preserve existing Notes and distinct topical annotations together. Never treat
  arbitrary note text as a topic. Explicit `Related:` labels generate suggestions
  only for unique exact-name matches to existing topics; unmatched labels require
  review. `--include-related-topics` includes those suggestions in the reviewed
  plan. Existing links and the topic hierarchy remain intact.
- Map finer POS labels to the current app taxonomy explicitly: proper noun to
  noun; prepositional verb to verb; abbreviation to other; the supported phrase,
  expression, question and date-format labels to phrase. Retain the original label
  in Notes and report each normalization. Unsupported values are errors. POS
  changes that would collide with another Word ID are unresolved conflicts.
- Knowledge, progress events, queues, usage history, pronunciation, images, verb
  forms, synonyms, antonyms, collocations and other non-content fields are protected.
  The application verifies their digest before and after a batch.

## Review and apply

Run these commands in the authorized operator environment with the backend on
the Python path. These examples contain no production connection information.

```sh
python -m app.scripts.sync_vocabulary_workbook input.xlsx --report dry-run.json
```

Exit 2 means the report contains unresolved conflicts or invalid data. Validation
errors always block writes. `--skip-conflicts` explicitly leaves each conflicted
Word ID entirely unchanged; otherwise any conflict blocks the whole application.
Use identical options and resolutions for the reviewed dry run and its application.

```sh
python -m app.scripts.sync_vocabulary_workbook input.xlsx \
  --report applied.json --apply --expected-plan <reviewed-plan-sha256> \
  --backup recovery-before.json
```

Application uses one repeatable-read transaction and row locks. The current plan
must match the reviewed hash; learning changes between dry run and application do
not replace current progress. A new recovery snapshot is flushed to disk,
checksummed and read back before any writes. Existing snapshots cannot be
overwritten. Entry-position deletions are flushed before batched replacements to
respect the database uniqueness constraints. An exception aborts the transaction.

## Recovery and verification

```sh
python -m app.scripts.sync_vocabulary_workbook \
  --restore-backup recovery-before.json --report rollback-dry-run.json
python -m app.scripts.sync_vocabulary_workbook \
  --restore-backup recovery-before.json --report rollback-applied.json \
  --apply --expected-plan <rollback-plan-sha256> --backup before-rollback.json
```

Recovery restores only changed content fields, preserving current progress. It
rejects a corrupted snapshot or a later manual content edit instead of overwriting
it. Word IDs remain stable; translation/example entry IDs and `updated_at` are not
rewound. A repeated import should produce zero changes. Export through
`build_words_workbook`, then reconcile the export and original source again;
preserved old examples, blank source cells, retained Notes, POS normalization,
protected knowledge values and deliberately skipped conflicts are expected
differences. Investigate every other difference.
Legacy separators inside a deliberately skipped translation entry can also
normalize when the export is parsed. Report the affected Word ID and keep that
entry unchanged until its conflict is reviewed.

Regression coverage: `tests/features/words/test_workbook_sync.py` uses a real
transactional database schema, alongside the existing workbook importer tests.
