# Portuguese pronunciation review — 28 October 2026

Reviewed all 500 supplied Portuguese entries, retaining exact Word IDs
19861–20360, language `pt`, original spellings and parts of speech. The selected
variety is European Portuguese from Portugal, not Brazilian Portuguese.

Outputs:

- `pt-reviewed.jsonl`: 500 complete approximate learner hints; zero held rows.
- `pt-review-decisions.json`: all 500 review decisions and references.
- `pt-review-build.py`: reproducible rendering and the explicit lexical/phrase overrides.

All 105 original flags were resolved through full model/context review, European
Portuguese phonetic rules, supplied IPA comparisons and targeted primary-dictionary
checks. Original `ready` readings were reviewed too. These are reviewed
**approximations**, not individually native-audio-verified transcriptions. No
app code, database, progress, vocabulary relationships or source files were changed.

Systematic source problems corrected:

- False extra vowels after /r/: porta, carne, mercado, árvore and many others.
- Literal extra nasal consonants: criança, amanhã, coração, pão, sim, bom.
- Unreduced unstressed e, where appropriate for Portugal.
- Incorrect syllabification of diphthongs, palatal lh/nh and connected phrases.
- Spurious stress on enclitic `-se`; missing word stress in phrase components.
- Brazilian-like coda-l vocalization in azul/pulso; Portugal uses dark /ɫ/.
- Confirmed individual errors: sangue does not pronounce written u; t-shirt is
  /tiˈʃɐrt/; Portuguese e-mail has the dictionary reading /iˈmɐjɫ/; exercício and
  exame begin with /i/ in the chosen dictionary readings; explicar uses /ʃ/.

Notation:

- Acute accent marks a helpful citation-word stress. Phrase focus changes.
- `~` marks a nasal vowel/diphthong immediately before it, never an added n/m.
  Actual consonantal n/m/nh are preserved.
- `ы` is a deliberately weak approximation of /ɨ/, often almost absent in
  everyday Portuguese speech; it must not be read as a strong Russian vowel.
- `й` and `у` in diphthongs/glides should not acquire extra syllables.
- Open/closed e/o and strong/weak r are not fully representable in Russian
  letters. Specific minimal-pair warnings are present for avó/avô and colher.
- Foreign Wi-Fi retains an English-type variant; its note acknowledges local
  competing readings rather than claiming one globally invariant pronunciation.

Primary references are listed in the JSON decision record. Targeted Infopédia
Porto Editora entries include porta, azul, pulso, obrigado, t-shirt, e-mail,
exercício, exame, explicar, coração, colher, sangue, joelho, candeeiro and óleo.
The Practice Portuguese vowel guide supports European reduction, nasalization,
stress and open/closed vowel distinctions. No dictionary corpus was copied into
the output, and no native-audio certification is claimed.
