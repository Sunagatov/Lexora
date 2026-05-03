from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en"
TIMEOUT = 5.0


@dataclass
class DictionaryResult:
    definition: str | None = None
    pronunciation_ipa: str | None = None
    pronunciation_audio_url: str | None = None
    part_of_speech: str | None = None
    examples: list[str] = field(default_factory=list)
    synonyms: list[str] = field(default_factory=list)
    antonyms: list[str] = field(default_factory=list)


def _parse_response(data: list[dict]) -> DictionaryResult:
    result = DictionaryResult()
    if not data:
        return result

    entry = data[0]

    for phonetic in entry.get("phonetics", []):
        if not result.pronunciation_ipa and phonetic.get("text"):
            result.pronunciation_ipa = phonetic["text"]
        if not result.pronunciation_audio_url and phonetic.get("audio"):
            result.pronunciation_audio_url = phonetic["audio"]

    for meaning in entry.get("meanings", []):
        if not result.part_of_speech and meaning.get("partOfSpeech"):
            result.part_of_speech = meaning["partOfSpeech"]

        for defn in meaning.get("definitions", []):
            if not result.definition and defn.get("definition"):
                result.definition = defn["definition"]
            if defn.get("example"):
                result.examples.append(defn["example"])
            result.synonyms.extend(defn.get("synonyms", []))
            result.antonyms.extend(defn.get("antonyms", []))

        result.synonyms.extend(meaning.get("synonyms", []))
        result.antonyms.extend(meaning.get("antonyms", []))

    # deduplicate preserving order
    result.synonyms = list(dict.fromkeys(result.synonyms))
    result.antonyms = list(dict.fromkeys(result.antonyms))

    return result


async def fetch_dictionary(term: str) -> DictionaryResult | None:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{DICTIONARY_API_URL}/{term}")
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return _parse_response(resp.json())
    except Exception:
        logger.warning("dictionary_api_error", extra={"event": "dictionary_api_error", "term": term}, exc_info=True)
        return None
