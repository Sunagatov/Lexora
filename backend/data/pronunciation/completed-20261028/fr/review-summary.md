# French pronunciation review — 28 October 2026

Reviewed all 500 France-French entries with their supplied Russian meaning,
part of speech, original hint and phonetic proposal. All original IDs, terms
and parts of speech remain exact. All 98 original review flags are resolved
as approximate, careful citation/phrase readings; no unresolved readings remain.

Output: `fr-reviewed.jsonl` (500 ready / 0 needs_review), standard eight-field
pronunciation import schema. `fr-review-decisions.json` records 233 changed or
previously flagged rows, including 11 targeted corrections/context decisions.
The rendering script is only a way to write the reviewed decisions consistently,
not an automatic linguistic approval system.

Confirmed source mistakes corrected:

- dos (back): /do/, Russian hint до́, not the draft's ду́с.
- jean (clothing): джин, not the personal name Jean.
- pull (clothing): пюл, not пул.
- comment allez-vous: restore the formula's t liaison.
- ils / elles: separate alternatives, remove the spurious z between them.
- allons-y and je suis allergique à…: do not pronounce punctuation/letter names
  emitted by eSpeak. Keep the actual phrase/prefix, with explanatory notes.
- Choose final French rhythmic prominence for football; clarify contractions,
  optional liaison, standalone numeral readings and alternatives.

Notation:

- `а~`, `о~`, `э~`, `ё~` represent single nasal vowels, **without a separate н/м**.
  French un retains an accepted /œ̃/ citation variant; its common France merger
  with /ɛ̃/ is explained rather than falsely treated as an error.
- ю/ё are approximate rounded front vowels, without an initial й.
- р is an approximate representation of French uvular /ʁ/.
- The acute marks a tonic rhythmic-group endpoint, not fixed Russian lexical
  stress on every word. Schwa reduction and optional linking vary in speech.
- Literal slash alternatives retain separate reading boundaries.

Targeted primary/pedagogical references consulted:

- Larousse, [dos](https://www.larousse.fr/dictionnaires/college/dos/12904)
  and [jean](https://www.larousse.fr/dictionnaires/college/jean/22306).
- Académie française, [fils](https://www.dictionnaire-academie.fr/article/A9F0794)
  and [liaison guidance](https://www.academie-francaise.fr/questions-de-langue).
- Hachette FLE, [Mon Alter Ego transcriptions](https://monalterego.hachettefle.fr/ressources/MAE2_CA_PDF/transcriptions.pdf),
  including pull, jean and tee-shirt.
- University of Jyväskylä, [French liaison](https://research.jyu.fi/phonfr/20a.html),
  including the fixed comment allez-vous exception.
- [French phonetics teaching manual hosted by Università di Trieste](https://moodle2.units.it/pluginfile.php/428588/mod_resource/content/1/manuel%20phonetique.pdf),
  rhythmic groups and phrase-final accentuation.
- OQLF, [imperative pronouns](https://vitrinelinguistique.oqlf.gouv.qc.ca/24206/la-grammaire/les-pronoms/pronoms-personnels/pronoms-personnels-employes-avec-un-verbe-a-limperatif).

Limits: these are reviewed learner approximations. The eSpeak proposals were
cross-checked with linguistic knowledge and targeted references, not trusted
blindly. **No individual native-audio verification or linguistic certification**
is claimed, and this reviewer changed no production database or application code.
Root must validate fresh live identities/meaning and rehearse the scoped import.
