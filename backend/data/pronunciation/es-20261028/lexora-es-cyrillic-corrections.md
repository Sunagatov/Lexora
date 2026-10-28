# 🇪🇸 Lexora — Spanish pronunciation audit · 28 October 2026

- Dataset: `lexora-vocabulary.xlsx` (500 distinct Spanish Word IDs, 18861–19360).
- Reviewed all 500 entries against exact Excel identities, Spanish orthographic pronunciation and eSpeak Spanish IPA as an independent automated comparison.
- Corrected 1 clearly incorrect consonant and 5 contextual nasal approximations; 3 additional notes added.
- These are Cyrillic learner hints, not native audio, IPA or a linguistic certification.
- Import approval: **NOT GRANTED** pending human/audio quality sampling.

## Changes

| Word ID | Spanish | Before | After | Why |
|---:|---|---|---|---|
| 18876 | bienvenido | бьенбэни́до | **бьембэни́до** | Испанское n перед b произносится как [m]; «бьем» — приблизительная подсказка. |
| 19096 | montar en bicicleta | монта́р эн бисиклэ́та | **монта́р эм бисиклэ́та** | В связной речи конечное n в en перед b обычно звучит как [m]. |
| 19130 | la policía | ла полики́а | **ла полиси́а** | Звук c перед í в Испании межзубный, как английское th в think; «с» — условная кириллическая замена. Буква к здесь не произносится. |
| 19263 | enfadado | энфада́до | **эмфада́до** | Перед f испанский носовой звук становится губно-зубным [ɱ]; русское м здесь только приближение. |
| 19294 | enviar | энбья́р | **эмбья́р** | Испанское n перед v (которая звучит как b) произносится как [m]. |
| 19355 | me gustaría un poco de agua | мэ густари́а ун по́ко дэ а́гуа | **мэ густари́а ум по́ко дэ а́гуа** | В связной речи n в un перед p обычно произносится как [m]. |

## Important unchanged conventions
- European Spanish c before e/i, and z: [θ], not ordinary Russian «с». The guide uses «с» with an explicit warning; use audio or IPA to learn the distinction.
- Russian «рр» denotes strongly rolled Spanish r at word start and spelled rr.
- Common yeísmo in central Spain means ll/y are often approximated with й/я.
- Pronunciation in phrases can be more connected or reduced than a word-by-word learner guide.

## Sources and limits
- Instituto Cervantes: https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/niveles/03_pronunciacion_inventario_b1-b2.htm
- Instituto Cervantes (Madrid): https://cvc.cervantes.es/lengua/voces_hispanicas/espana/madrid.htm
- Open University (nasal assimilation): https://www.open.edu/openlearn/mod/oucontent/view.php?id=106240&printable=1
- UOC (Spanish stress): https://www.uoc.edu/es/servicios/lengua-estilo/criterios/ortografia/acentuacion
- Automated comparison: installed eSpeak Spanish synthesis; not a native-speaker review.
- The file was not checked against 500 native audio clips.

## Verification
- All input Word IDs present exactly once (500/500).
- Preserved: Word ID, language, exact term, part of speech, and the workbook’s other fields.
- Checked: Cyrillic pronunciation remains nonblank, marked status valid, original meaning preserved.
- Output hashes in the updated manifest.
