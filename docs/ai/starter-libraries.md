# Reviewed starter libraries

The first starter release adds 500 everyday words/phrases to each of the eight new
learning libraries. English is deliberately excluded. Existing English vocabulary,
topics, ratings and history are never updated by this importer.

## Package contract

Supply UTF-8 JSONL files with exactly 500 records per language. The complete batch
must contain `zh`, `es`, `de`, `tr`, `tt`, `ar`, `fr` and `pt`. Each library uses the
same stable concept IDs `s001` through `s500`.

```json
{"id":"s001","topic":"Greetings","term":"你好","language":"zh","part_of_speech":"phrase","translations":{"ru":["здравствуйте","привет"],"en":["hello"]},"definitions":{"ru":"Приветствие при встрече.","en":"A greeting when meeting someone."},"examples":[{"text":"你好，我是安娜。","ru":"Здравствуйте, я Анна.","en":"Hello, I am Anna."},{"text":"老师，你好！","ru":"Здравствуйте, учитель!","en":"Hello, teacher!"},{"text":"你好，请进。","ru":"Здравствуйте, входите, пожалуйста.","en":"Hello, please come in."}],"transliteration":"nǐ hǎo"}
```

Required fields: `id`, `topic`, `term`, `language`, `part_of_speech`, both
`translations` arrays, both `definitions`, and exactly three `examples` objects
with source `text`, Russian `ru`, and English `en`. Optional fields:
`transliteration` and `grammar: {"ru": "…", "en": "…"}`. Mandarin requires pinyin.
Supported POS labels: noun, verb, adjective, adverb, phrase, preposition, other.

Use Simplified Mandarin, Modern Standard Arabic, Cyrillic Tatar and Portuguese
from Portugal. Supply natural equivalents only; four translations are not forced
where fewer accurate equivalents exist. Script presence, repeated translations,
concept IDs, example count and normalized word/POS identities are validated.
Arabic vocalized and unvocalized spellings count as the same identity. These
structural checks support, but do not replace, independent linguistic review.

## Preview and apply

Production execution, backups and deployment belong in Vault. The commands below
show the source-owned entrypoint without connection information. It uses the
configured application environment and refuses an implicit SQLite fallback.

```sh
python -m app.scripts.import_starter_libraries packages/*.jsonl --report preview.json
python -m app.scripts.import_starter_libraries packages/*.jsonl --report applied.json \
  --apply --expected-plan <reviewed-plan-sha256>
```

Dry-run is read-only and returns counts, per-language actions, conflicts and a
plan SHA256 binding both the content and existing seed state. Apply rebuilds the
plan under the existing PostgreSQL word-identity advisory lock and row locks; any
conflict or stale hash aborts the whole batch. A complete recoverable database
backup and review of the eight language packages are operator prerequisites.

All eight libraries commit in one transaction. New words start Weak (`1`), receive
the language-scoped topic, and retain Russian and English translations,
definitions and optional grammar notes. Each example is one stored string:
`XX: source text\nRU: Russian translation\nEN: English translation`.

## Preservation and retries

`Word.source` is limited to ten characters. The importer reserves `start1s001`
through `start1s500`; the Word language completes the seed identity. Existing
words without the expected marker are conflicts, including entries in Trash.
It never merges an existing manual entry or restores a deleted entry implicitly.

An exact prior seed entry is skipped. Its current rating, history, topic
assignments, pronunciation and unrelated metadata remain untouched. Editing its
seed-owned term, POS, translations, definitions, examples, grammar notes,
transliteration or active/deleted state instead requires explicit review and
blocks the import; such edits are never overwritten. No missing old topic is
recreated merely for an already-installed entry.

Run a fresh dry-run for repeat imports. It should report zero created words and
4,000 skipped words. A lost response can be checked this way without duplicating
entries; reusing the old create-plan hash is intentionally rejected once the
database state has changed.

The feature functions do not commit. Code callers must own a Session transaction
and roll it back on errors. The CLI owns the complete transaction and writes its
audit result before committing. Structural/transaction regression coverage is in
`backend/tests/features/test_starter_libraries.py` using a disposable SQLite DB;
PostgreSQL rehearsal remains an operational release check.
