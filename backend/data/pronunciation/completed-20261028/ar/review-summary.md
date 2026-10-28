# Independent Arabic check of 139 proposed resolutions

Reviewed all 139 matched IDs against their intended Russian meanings, the supplied
root readings and standard Arabic syllable/stress rules. This was a model review,
not individual native-audio certification. No source resolutions, app code or
database records were edited.

The proposed patch file has three changes:

- **18348**: definite stress error, `lišaḵṢAYN`, not `liŠAḵṣayn`. Final diphthong
  plus consonant is superheavy, so it takes stress.
- **17866**: if the field is intended as a connected phrase, use `ilal-liqāʔ`.
  The existing separate citation-word representation is understandable but should
  not be described as an exact connected reading.
- **17880**: likewise, connected `ma-smuka` elides the initial i of ismuka.

The remaining reviewed readings are defensible approximations of the chosen
formal/citation varieties, with these qualifications:

- `yumkinuka` and `yumkinunī` require stress on **ki**, as root has now corrected.
- Retain **hayyā**'s long final ā and **bí-nā**. The pronominal suffix attached
  directly to bi- is an exception to the general instruction to ignore proclitics.
- **bi-KAM** and **li-MAN** should keep their final stress. Do not apply the
  ordinary two-syllable initial-stress rule to these proclitic-plus-full-word forms.
- Formal geminated **-iyy** in majjāniyy, manziliyy and mūsīqiyy takes final stress.
  Spoken -ii variants can move stress backward. A note should distinguish the
  chosen formal geminated form from common spoken reductions.
- faṭūr/fuṭūr, binṭāl/banṭāl and other dictionary-supported lexical variants must
  not be called errors merely because another variant is more familiar. Root's
  chosen variants are coherent with its reference checks.
- Paused tāʔ marbūṭa following a long ā in fatāh/miqlāh can be represented with a
  weak h in a careful citation pronunciation. It is not the construct -t form.
- Many multiword strings preserve article vowels as **segmented citation words**.
  A general note should say this explicitly; in actual connected MSA, hamzat
  al-waṣl is elided and case/bridge vowels may occur. Avoid pretending those
  segmented strings are a complete phonetic rendering of one uninterrupted utterance.

Primary/reference material:

- Jack Halpern, [Word Stress and Vowel Neutralization in Modern Standard Arabic](https://www.cjki.org/arabic/an_paper.pdf),
  especially §2 (proclitics), §4 (CVVC/diphthong-final stress), §5.2 (bi-KAM),
  §5.4 (formal -iyy versus spoken -ii), §5.5 (ilal-liqāʔ), and §5.6 (pronominal
  exceptions on bi-/li-).
- [Wiktionary ما اسمك](https://en.wiktionary.org/wiki/ما_اسمك), connected /ma‿s.mu.ka/
  and feminine /ma‿s.mu.ki/.
- [UC Davis Arabic Without Walls](https://arabicwithoutwalls.ucdavis.edu/alifbaa_unit2/ab2_phrases_vocab.html),
  formal name-question forms and masculine/feminine distinctions.
- Existing contextual Arabic dictionary extracts were checked where useful;
  they are not copied into this output.
