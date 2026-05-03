from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

import httpx

from app.shared.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT = 15.0

SYSTEM_PROMPT = """\
You are a vocabulary enrichment assistant for an English learner whose native language is Russian.
Given an English word or phrase, return a JSON object with these exact keys:

{
  "definition": "concise English definition",
  "part_of_speech": one of "noun","verb","adjective","adverb","phrase","preposition","phrasal verb","other",
  "cefr_level": one of "A1","A2","B1","B2","C1","C2",
  "register": one of "formal","informal","neutral","slang","technical",
  "countability": one of "countable","uncountable","both","plural","collective" or null if not a noun,
  "frequency_rank": integer estimate of rank in English frequency lists (1=most common),
  "pattern": grammatical pattern e.g. "verb + to-infinitive",
  "translation_entries": ["Russian translation 1","Russian translation 2"] (2-3 contextual translations),
  "example_entries": ["example sentence 1","example sentence 2","example sentence 3"] (3 graded examples),
  "synonym_entries": ["synonym1","synonym2","synonym3"] (3-5 synonyms),
  "antonym_entries": ["antonym1","antonym2"] (2-3 antonyms, or empty if none),
  "collocation_entries": ["collocation1","collocation2","collocation3"] (3-5 common collocations),
  "confusable_entries": [{"value":"confused_word","explanation":"why they differ"}] (1-2 commonly confused words),
  "verb_form": {"past_simple":"...","past_participle":"...","present_participle":"...","third_person":"..."} or null if not a verb,
  "notes": "brief usage note or null"
}

Return ONLY valid JSON. No markdown, no explanation.\
"""


@dataclass
class GeminiResult:
    definition: str | None = None
    part_of_speech: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    countability: str | None = None
    frequency_rank: int | None = None
    pattern: str | None = None
    notes: str | None = None
    translation_entries: list[str] = field(default_factory=list)
    example_entries: list[str] = field(default_factory=list)
    synonym_entries: list[str] = field(default_factory=list)
    antonym_entries: list[str] = field(default_factory=list)
    collocation_entries: list[str] = field(default_factory=list)
    confusable_entries: list[dict] = field(default_factory=list)
    verb_form: dict | None = None


def _parse_gemini_response(data: dict) -> GeminiResult | None:
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return None

    # Strip markdown code fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        return None

    if not isinstance(obj, dict):
        return None

    def str_list(key: str) -> list[str]:
        val = obj.get(key)
        return [s for s in val if isinstance(s, str) and s.strip()] if isinstance(val, list) else []

    result = GeminiResult(
        definition=obj.get("definition") if isinstance(obj.get("definition"), str) else None,
        part_of_speech=obj.get("part_of_speech") if isinstance(obj.get("part_of_speech"), str) else None,
        cefr_level=obj.get("cefr_level") if isinstance(obj.get("cefr_level"), str) else None,
        register=obj.get("register") if isinstance(obj.get("register"), str) else None,
        countability=obj.get("countability") if isinstance(obj.get("countability"), str) else None,
        frequency_rank=obj.get("frequency_rank") if isinstance(obj.get("frequency_rank"), int) else None,
        pattern=obj.get("pattern") if isinstance(obj.get("pattern"), str) else None,
        notes=obj.get("notes") if isinstance(obj.get("notes"), str) else None,
        translation_entries=str_list("translation_entries"),
        example_entries=str_list("example_entries"),
        synonym_entries=str_list("synonym_entries"),
        antonym_entries=str_list("antonym_entries"),
        collocation_entries=str_list("collocation_entries"),
    )

    vf = obj.get("verb_form")
    if isinstance(vf, dict):
        result.verb_form = {k: vf.get(k) for k in ("past_simple", "past_participle", "present_participle", "third_person")}

    ce = obj.get("confusable_entries")
    if isinstance(ce, list):
        result.confusable_entries = [
            {"value": item["value"], "explanation": item.get("explanation")}
            for item in ce
            if isinstance(item, dict) and isinstance(item.get("value"), str)
        ]

    return result


async def fetch_gemini(term: str) -> GeminiResult | None:
    if not settings.gemini_api_key:
        return None

    model = settings.gemini_model
    url = f"{GEMINI_API_URL}/{model}:generateContent?key={settings.gemini_api_key}"

    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": term}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            return _parse_gemini_response(resp.json())
    except Exception:
        logger.warning("gemini_api_error", extra={"event": "gemini_api_error", "term": term, "model": model}, exc_info=True)
        return None
