# Everyday starter vocabulary — 27 October 2026

This content release contains 500 words and useful expressions in each of eight
separate learning libraries: Simplified Mandarin, Spain Spanish, Germany German,
Turkey Turkish, Cyrillic Tatar, Modern Standard Arabic, France French and Portugal
Portuguese. Every library has 20 topics of 25 entries. English is excluded.

Each entry supplies Russian and English translations and definitions, three
native examples with both translations, and grammatical notes where useful.
Mandarin entries include tone-marked pinyin. New entries start at Weak. Translation
lists contain natural equivalents; they are not padded with invented synonyms to
reach a fixed number.

The JSONL contract and reviewed-plan importer are documented in
[`docs/ai/starter-libraries.md`](../../../../docs/ai/starter-libraries.md).
`manifest.json` records file hashes, counts and review coverage. Import the eight
language JSONL files together, using a read-only preview, restored-backup rehearsal
and explicit matching plan hash. Production operations belong in Vault. Publishing
these files alone does not install vocabulary or modify a database.

The positions `s001`–`s500` provide stable import identities within each language.
They are not universal sense IDs. A small number of concepts differ by language
where literal translation would create a duplicate or teach an unnatural form.
For example, French `bonne journée` is a parting wish, Spanish `temprano` means
early, and Arabic `السلام عليكم` is a greeting. Their complete translations,
definitions and examples state their actual meanings. Language-specific kinship,
gender, tense and usage distinctions are described in grammar notes.

The material was generated using model language capabilities without external AI
API calls. Author self-review, independent model checks and automated checks cover
structure, duplicates, script/encoding, meanings and representative example
alignment. This does not constitute human native-speaker certification.
