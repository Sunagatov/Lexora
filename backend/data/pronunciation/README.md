# Reviewed pronunciation data

These are approximate reading aids for Russian-speaking learners. IPA, Mandarin
Pinyin and pronunciation audio remain separate, unmodified fields. Do not treat
`ready` as authorization or a claim of native-speaker certification.

## Initial 28 October 2026 review

| Library | Supplied IDs | Eligible | Held |
| --- | ---: | ---: | ---: |
| Spanish | 500 | 500 | 0 |
| Mandarin | 500 | 500 | 0 |
| Tatar | 500 | 459 | 41 |
| Turkish | 500 | 384 | 116 |
| Arabic | 500 | 361 | 139 |

Spanish was handled separately. Each additional directory contains the original
JSONL, manifest and guide, plus a reviewed JSONL, its checksum manifest and a
decision record. Mandarin also retains the original Russian-hint sidecar:
the primary source's `pronunciation_easy` contains Pinyin and is **not** the
Russian hint input. No stored Pinyin is replaced.

All 2,000 additional identities were compared with the live library: exact ID,
language, spelling and part of speech matched. The full supplied readings were
reviewed with their meanings and existing Pinyin. Dictionary comparisons and
targeted stress/reading checks informed the corrections. Examples include
Mandarin 音乐 yīnyuè and 重复 chóngfù, Turkish nasılsın's initial stress, and
Arabic نافذة's initial stress. Entries lacking a defensible reading remain held,
including newly discovered uncertainties in rows originally marked ready.

Arabic flag resolutions use the intended meaning/POS, matching MSA dictionary
phonemes and syllable-based stress rules; an orthographic match alone is not
enough. Tatar's accented spelling is a reading aid rather than a narrow phonetic
transcription. Turkish dictionary-generated default stress was not accepted
blindly: explicit lexical exceptions such as ANne take precedence. Mandarin
accepts documented citation/conversational variants and explains tone changes.

No individual native-audio verification was performed. The original manifests'
approval remains false. Reviewed manifests also require explicit operator review;
held hints are null, with their reasons in the JSONL. These are useful learner
approximations, not a linguistically certified dataset.

## Source folders

- [Spanish](https://drive.google.com/drive/folders/1-f2YkLNc9hcKAvsc-tJ3GRp8spwkJ8U2)
- [Mandarin](https://drive.google.com/drive/folders/1jP991uEGvI5g8QdAXXgEcuLTW7QBGDhX)
- [Tatar](https://drive.google.com/drive/folders/1wyxsiaelEFn84Pem2XQkjobwPH1nemFa)
- [Turkish](https://drive.google.com/drive/folders/1Ymzeibsya85Q_qq7wc4savOMsGNY5G4A)
- [Arabic](https://drive.google.com/drive/folders/1QNa8fQ8NXemI5BGoxOKfN-nxxXTBzZuV)

## References consulted

References were used for comparison and targeted checks, not copied as a new
vocabulary corpus. External dictionary snapshots remain outside this repository.

- [MDBG CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict),
  CC-BY-SA 4.0, and Zdic entries for
  [重复](https://www.zdic.net/hans/重复), [音乐](https://www.zdic.net/hans/音乐),
  [爱好](https://www.zdic.net/hans/爱好), [空闲](https://www.zdic.net/hans/空闲)
  and [照相机](https://www.zdic.net/hans/照相机).
- Wiktionary dictionary extracts through Kaikki:
  [Turkish](https://kaikki.org/dictionary/Turkish/index.html),
  [Tatar](https://kaikki.org/dictionary/Tatar/index.html),
  [Arabic](https://kaikki.org/dictionary/Arabic/index.html).
  Coverage and transcription quality vary; a generated stress mark is not an
  independent linguistic review.
- TDK-published Talat Tekin,
  [Çağdaş Türk Dilleri / Makaleler III](https://tdk.gov.tr/wp-content/uploads/2023/03/1062.-Makaleler-III-Cagdas-Turk-Dilleri.pdf),
  Turkish lexical stress and suffix rules.
- [Azatliq Tatar stress lesson](https://www.azatliq.org/amp/31824886.html),
  including exceptions for questions, negative verbs, compounds and loans.
- Jack Halpern,
  [Word Stress and Vowel Neutralization in Modern Standard Arabic](https://www.cjki.org/arabic/an_paper.pdf),
  alongside [MSA stress guidance](https://modern-standard-arabic.net/en/ee_chapters/6-stress/).

For import/recovery contracts see
[`docs/ai/easy-pronunciation.md`](../../../../docs/ai/easy-pronunciation.md).
Runtime backup locations and operation results belong in Vault.

## Completed starter coverage

`completed-20261028/` contains the subsequent full 500-entry packages for German,
French, Portugal Portuguese, Tatar, Turkish and Arabic. It adds 1,796 missing hints
and preserves the 1,204 existing hints in these six libraries exactly. Together with
the separate Spanish and Mandarin packages this covers all eight 500-word starters.
Original files and initial held statuses remain preserved as historical evidence.

Each new package has a JSONL, checksum manifest, review summary and decisions.
The new German/French/Portuguese source packages are retained byte-for-byte too;
their original workbook/file checksums and all live identities were verified.
Original `ready` rows were reviewed along with source flags. Existing English,
Spanish and Mandarin fields are outside this completion import.

These remain learner approximations, not individual native-audio certifications.
Some uncertain/variable lexical stresses are deliberately left unmarked and
explained rather than guessed. French/Portuguese `~` means nasalization, not an
extra n/m; Arabic uses documented citation/segmented forms and explicit connected
forms where checked. Read each package's notes before treating its spelling as IPA.
