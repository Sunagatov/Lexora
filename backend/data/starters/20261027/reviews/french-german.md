# Independent French and German content review

Reviewed on 27 October 2026 using the reviewer's own language abilities. No AI
provider credentials, external generation service, or production mutation was used.

## Coverage

- Read all 500 French and all 500 German native headwords against the shared
  concept list, checking ordinary meanings, obvious false friends, same-POS
  duplication workarounds, and language-specific sense choices.
- Reviewed three native examples and their canonical English/Russian pairs for
  the same 50 representative entries in each language: 150 French plus 150
  German example sentences. Checked full overrides when they replace canonical
  meanings/examples, together with relevant definitions, glosses and grammar.
- Sample IDs: s003, s012, s019, s028, s031, s039, s045, s046, s067, s070,
  s083, s088, s098, s100, s108, s149, s167, s168, s174, s190, s196, s207,
  s210, s230, s250, s251, s256, s262, s266, s283, s300, s308, s315, s328,
  s336, s337, s359, s361, s404, s406, s407, s432, s439, s459, s460, s464,
  s473, s474, s475, s490.

## Corrections

The inherited Russian gloss for s439 included «быть нужным», reversing the
direction of need. German **brauchen** and French **avoir besoin de** now use
«нуждаться в» and «испытывать потребность в», with English need/require. Existing
definitions and example pairs were already correct and remain unchanged. The
parent also corrected this shared curriculum gloss for the other languages.

Added a short German s337 usage note: **sich an + accusative erinnern** for
remembering someone/something; **daran denken, etwas zu tun** for remembering
to perform an action. This explains the natural construction in its third example.

## Confirmed sense decisions

French bonne journée is explicitly a parting wish, distinct from daytime
bonjour. Jeune fille covers a girl/young woman rather than duplicating the daughter
entry fille. Toilettes is correctly plural and can name a fixture in context.
Bistrot has an explicit café-bar/small-restaurant definition, distinct from the
drink café. Tiède has its own lukewarm gloss, definition and three bilingual
example overrides, rather than incorrectly reusing warm-coat/room sentences.
Native constructions avoir peur/faim/soif and avoir besoin de have phrase tags.

German Landstraße and Hosentasche have their narrower country-road and
trouser-pocket definitions; the trouser example's RU/EN override is consistent.
Laden/shop versus Geschäft/business are real natural headwords. Wissen/kennen,
legen/stellen and contextual idioms are explained instead of forcing English
word-to-word correspondence. Noun/adverb Morgen/morgen are intentionally distinct
parts of speech. Angst haben is a phrase with matching gloss and examples.

## Validation and limits

After these corrections, `assemble.py de fr` passed all 500 records per language.
`check-writing.py` reported zero encoding/script issues across the available
language files. No remaining blocker was found in the reviewed sample.

This is an independent AI content review, not human native-speaker certification.
It checks all headwords and the stated sample; it does not claim an exhaustive
linguistic review of all 3,000 French/German example sentences.
