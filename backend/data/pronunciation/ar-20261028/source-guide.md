# 🇸🇦 Lexora — Modern Standard Arabic pronunciation guide (for Russian-speaking learners)
## Scope and safety
- Learning language: `ar` (Modern Standard Arabic, MSA / الفصحى). Translation: `ru`.
- These are **proposed, rule-based pronunciations**, NOT 500 individually audio-verified pronunciations.
- This Excel export normally lacks short vowel marks (ḥarakāt). Arabic words may require contextual interpretation.
- Use the original Arabic spelling as-is. **Never overwrite existing IPA, audio, translations, word identity, topics, learning progress or database records.**
- For records with `needs_review`, the main JSONL intentionally has `pronunciation_easy: null`. Their suggested readings are in the **separate review/romanization sidecar**. Do NOT fill nulls automatically.
- Even `ready` indicates a provisionally well-formed reading, **not authorization for automatic database import**.
## Pronunciation representation
- Main `pronunciation_easy`: approximate Cyrillic with `´` stress (combining acute) and `:` after a vowel for long vowels. Examples: كتاب *kitāb* → «кита́:б»; صباح *ṣabāḥ* → «саба́:х».
- Separate sidecar: more precise **proposed academic-style Latin transliteration**, with `ā ī ū` indicating vowel length.
- The transliteration is *not official IPA* and is not guaranteed to reproduce regional spoken Arabic.
- In Russian hints, `ق` is approximately «къ» (deep uvular /q/, not Russian к); `ح` ≈ «х» but is pharyngeal; `ع` is written «ъ» (a distinct pharyngeal consonant, **not** an ordinary Russian hard sign).
- `خ` ≈ «х», `غ` ≈ «г» with a voiced velar/uvular quality; `ث` is approximately «с» but actually /θ/; `ذ` ≈ «з» but actually /ð/.
- Emphatic ص ض ط ظ are shown using simple Cyrillic consonants for convenience, but the Arabic originals are darker/velarized.
- A right apostrophe «ʼ» in hints represents a glottal stop (همزة, hamza).
- Digraphs in Latin sidecar: sh = ش, kh = خ, gh = غ, th = ث, dh = ذ.
- Diphthongs `aw/ay` and the Arabic /w/ are only approximated in Cyrillic; prioritize Arabic audio when available.
- Arabic `ال` assimilates before **sun letters**, e.g. السلام → *as-salām*; article pronunciation changes at word boundaries.
- Tāʾ marbūṭa ة often becomes pausal -a(h) but appears as -at in construct and grammar contexts.
- Romanized Arabic word-final case endings and tanwīn are generally **not supplied** for isolated citation forms; case requires sentence syntax. Fixed adverbs/greetings such as *shukran* may preserve -an.
- Cyrillic stress is heuristic, with special risks in longer phrases, loans and inflected words. A stress accent is not proof of verification.
## How to use the machine files
- `lexora-ar-cyrillic-pronunciation.jsonl`: EXACT original IDs, language ar, original term and POS, status and issue, with only provisionally unambiguous easy pronunciations populated.
- `lexora-ar-romanization-proposals.jsonl`: proposed Latin and Cyrillic renderings for all 500 IDs, **including 276 review-only drafts**.
- `lexora-ar-needs-review.csv`: priority review queue; check lexical vowels, grammatical form, assimilation, vowel length, stress and phrase linkage.
- `lexora-ar-pronunciation-review.xlsx`: two tabs, all entries and review queue, plus guide.
- `lexora-ar-pronunciation-manifest.json`: hashes, counts, approval gate.
- `lexora-ar-review-report.md`: input validation, exceptions and remaining human verification.
## Recommended validation
1. Cross-check each `needs_review` item against a vocalized MSA dictionary and contextual examples; flag gender/case/verb-tense ambiguity explicitly.
2. Sample **even provisional ready** pronunciations against native MSA recordings with an Arabic-speaking teacher.
3. Distinguish MSA citation forms from colloquial Arabic dialects and from fully inflected classical recital.
4. Do not import until the application/Codex handles the chosen Cyrillic representation and approval gate, and the reviewed corpus is reconciled.
## References (general linguistic conventions, not row-level dictionary checks)
- Cambridge, *A Reference Grammar of Modern Standard Arabic* (phonology and script): https://www.cambridge.org/core/books/abs/reference-grammar-of-modern-standard-arabic/phonology-and-script/8CF8574CCCBC16657222C37874905587
- Lingualism, MSA case endings / pausal conventions: https://resources.lingualism.com/modern-standard-arabic/modern-standard-arabic-phonemic-transcription/
- MSA stress patterns: https://modern-standard-arabic.net/en/ee_chapters/6-stress/
