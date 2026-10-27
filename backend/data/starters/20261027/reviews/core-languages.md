# Independent Mandarin, Tatar, Arabic and Turkish sample review

27 October 2026. Reviewed 20 complete three-example entries in each language:
80 entries and 240 native sentences, with their Russian/English translations,
native POS and relevant sense/grammar notes.

Sample IDs in each language: s003, s012, s032, s054, s067, s107, s144, s149,
s195, s251, s283, s328, s336, s359, s404, s435, s436, s439, s459, s489.

## Two corrections applied

1. Arabic s149's original lemma **غلى** names intransitive boiling, whereas its
   definition and Russian gloss teach heating/boiling something. Changed the
   lemma to transitive **أغلى**. Existing native examples and the accurate usage
   note remain: غلى for a liquid boiling, أغلى for boiling a liquid, and سلق
   for cooking food in boiling water. No duplicate أغلى headword existed.
2. Tatar s359 **кайнар** now has Russian **горячий** and English **hot** as its
   translation arrays. Removed the inherited weather gloss «жаркий». Its note
   already correctly distinguishes hot objects/liquids кайнар from hot weather
   эссе; the native weather sentence remains as an explicitly explained contrast.

## Sample outcomes

Mandarin kinship narrowing, cooked-rice wording, native fever/fear verb labels,
physical manufacture, location construction, and station examples agree with
their documented senses. Tatar's earlier afternoon/postposition POS corrections,
have-a-meal phrase overrides, sympathy example and recipient/dative constructions
are present. Arabic's alternative greeting, informative tell sense, hot-object
examples and native phrase labels are consistent. Turkish's rice/pilav,
boil/haşlamak, receive/almak, pronouns and postpositional location examples are
explained rather than forced into identical English forms.

No additional concrete blocker was found in these 20-entry samples per language.
This report covers the stated samples, not all 6,000 examples in the four sets.

## Checks after correction

- `assemble.py ar tt zh tr`: each language passed with exactly 500 entries.
- `check-writing.py`: zero encoding/script issues across all eight 500-entry files.
- Only the two stated staging records changed. No application code, credentials,
  repository history or production database was modified by this review.
