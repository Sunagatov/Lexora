from __future__ import annotations

from app.features.words.constants import (
    CEFR_LEVELS,
    COUNTABILITY_VALUES,
    PART_OF_SPEECH_VALUES,
    REGISTER_VALUES,
)
from app.features.words.enrich.dictionary_client import DictionaryResult
from app.features.words.enrich.gemini_client import GeminiResult
from app.features.words.enrich.schemas import ConfusableOut, EnrichResponse, VerbFormOut


def _dedup(items: list[str], limit: int = 10) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(item.strip())
        if len(out) >= limit:
            break
    return out


def _validate_choice(value: str | None, allowed: tuple[str, ...]) -> str | None:
    if value and value in allowed:
        return value
    if value and value.lower() in {v.lower() for v in allowed}:
        return next(v for v in allowed if v.lower() == value.lower())
    return None


def _validate_pos(value: str | None) -> str | None:
    return _validate_choice(value, PART_OF_SPEECH_VALUES)


def merge_enrichment(
    term: str,
    dict_result: DictionaryResult | None,
    ai_result: GeminiResult | None,
) -> EnrichResponse:
    d = dict_result or DictionaryResult()
    a = ai_result or GeminiResult()

    pos = _validate_pos(d.part_of_speech) or _validate_pos(a.part_of_speech)

    vf: VerbFormOut | None = None
    if a.verb_form and pos in ("verb", "phrasal verb"):
        vf = VerbFormOut(**{k: v for k, v in a.verb_form.items() if isinstance(v, str)})

    return EnrichResponse(
        term=term,
        definition=d.definition or a.definition,
        pronunciation_ipa=d.pronunciation_ipa,
        pronunciation_audio_url=d.pronunciation_audio_url,
        part_of_speech=pos,
        cefr_level=_validate_choice(a.cefr_level, CEFR_LEVELS),
        register=_validate_choice(a.register, REGISTER_VALUES),
        countability=_validate_choice(a.countability, COUNTABILITY_VALUES) if pos == "noun" else None,
        frequency_rank=a.frequency_rank if a.frequency_rank and a.frequency_rank >= 1 else None,
        pattern=a.pattern,
        notes=a.notes,
        translation_entries=_dedup(a.translation_entries, 5),
        example_entries=_dedup(d.examples + a.example_entries, 3),
        synonym_entries=_dedup(d.synonyms + a.synonym_entries, 5),
        antonym_entries=_dedup(d.antonyms + a.antonym_entries, 5),
        collocation_entries=_dedup(a.collocation_entries, 5),
        confusable_entries=[
            ConfusableOut(value=c["value"], explanation=c.get("explanation"))
            for c in a.confusable_entries
            if isinstance(c.get("value"), str)
        ][:3],
        verb_form=vf,
    )
