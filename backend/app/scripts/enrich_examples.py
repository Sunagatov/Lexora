"""
Automated examples enrichment for a Lexora topic.

Exports all words page by page, generates 3 example sentences per word using
an AI provider, and imports the results back automatically.

Supported providers and recommended cheap models:
  gemini    Gemini 1.5 Flash  — set GEMINI_API_KEY   (~$0.14 / 10k words, free tier available)
  openai    GPT-4o-mini       — set OPENAI_API_KEY   (~$1    / 10k words)
  anthropic Claude Haiku      — set ANTHROPIC_API_KEY (~$2   / 10k words)

Provider is auto-detected from which API key is present, preferring the
cheapest option (gemini > openai > anthropic). Use --provider to override.

Get a free Gemini API key: https://aistudio.google.com/app/apikey

Usage (from project root):
    PROD_PASSWORD=xxx GEMINI_API_KEY=xxx \\
    .venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --dry-run

    PROD_PASSWORD=xxx GEMINI_API_KEY=xxx \\
    .venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live

    # Switch provider if one hits rate limits:
    PROD_PASSWORD=xxx OPENAI_API_KEY=xxx \\
    .venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live --provider openai

    PROD_PASSWORD=xxx ANTHROPIC_API_KEY=xxx \\
    .venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live --provider anthropic

    # Resume from a specific page after a failure:
    .venv/bin/python -m app.scripts.enrich_examples --topic-id 6 --live --start-page 4

Or via Taskfile (from project root):
    task -t maintaner/Taskfile.yml enrich TOPIC_ID=6
    task -t maintaner/Taskfile.yml enrich TOPIC_ID=6 LIVE=true
    task -t maintaner/Taskfile.yml enrich TOPIC_ID=6 LIVE=true PROVIDER=openai
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Literal, Protocol, TypedDict, cast

import httpx

from app.shared.auth import CSRF_HEADER_NAME

_SYSTEM = (
    "You are a vocabulary enrichment assistant for an English learning app. "
    "Given a JSON array of words, output ONLY a JSON array — no wrapper object, "
    "no markdown, no explanation — in this exact shape: "
    '[{"id": <int>, "example_entries": ["sentence 1", "sentence 2", "sentence 3"]}]'
)

_DEFAULT_MODELS = {
    "gemini": "gemini-1.5-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
}

# Cheapest-first auto-detection order
_PROVIDER_PRIORITY = ["gemini", "openai", "anthropic"]

_KEY_ENV = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


class WordPayload(TypedDict):
    id: int
    example_entries: list[str]


class ChatMessage(TypedDict):
    role: Literal["system", "user"]
    content: str


def _user_prompt(words: list[WordPayload]) -> str:
    return (
        "Generate exactly 3 natural, concise English example sentences for each word. "
        "No Russian. Keep them practical and vocabulary-app friendly.\n\n"
        f"Words:\n{json.dumps(words, ensure_ascii=False)}"
    )


# ── Provider abstraction ───────────────────────────────────────────────────────

class AiProvider(Protocol):
    def enrich(self, model: str, words: list[WordPayload]) -> list[WordPayload]: ...


class GeminiProvider:
    """Uses Gemini via its OpenAI-compatible endpoint — no extra SDK needed."""
    def __init__(self, api_key: str) -> None:
        from openai import OpenAI
        self._client = OpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )

    def enrich(self, model: str, words: list[WordPayload]) -> list[WordPayload]:
        response_format = cast(Any, {"type": "json_object"})
        messages: list[ChatMessage] = [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _user_prompt(words)},
        ]
        resp = self._client.chat.completions.create(
            model=model,
            max_tokens=8192,
            response_format=response_format,
            messages=cast(Any, messages),
        )
        text = resp.choices[0].message.content or ""
        data = json.loads(text.strip())
        if isinstance(data, dict):
            data = next(iter(data.values()))
        return data


class OpenAIProvider:
    def __init__(self, api_key: str) -> None:
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key)

    def enrich(self, model: str, words: list[WordPayload]) -> list[WordPayload]:
        response_format = cast(Any, {"type": "json_object"})
        messages: list[ChatMessage] = [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _user_prompt(words)},
        ]
        resp = self._client.chat.completions.create(
            model=model,
            max_tokens=8192,
            response_format=response_format,
            messages=cast(Any, messages),
        )
        text = resp.choices[0].message.content or ""
        data = json.loads(text.strip())
        if isinstance(data, dict):
            data = next(iter(data.values()))
        return data


class AnthropicProvider:
    def __init__(self, api_key: str) -> None:
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)

    def enrich(self, model: str, words: list[WordPayload]) -> list[WordPayload]:
        msg = self._client.messages.create(
            model=model,
            max_tokens=8192,
            system=_SYSTEM,
            messages=cast(Any, [{"role": "user", "content": _user_prompt(words)}]),
        )
        return json.loads(msg.content[0].text.strip())


def _resolve_provider(provider_name: str | None) -> tuple[str, AiProvider]:
    if provider_name is None:
        # Auto-detect: pick cheapest available key
        for name in _PROVIDER_PRIORITY:
            if os.environ.get(_KEY_ENV[name]):
                provider_name = name
                break
        else:
            keys = ", ".join(_KEY_ENV.values())
            sys.exit(f"Error: no API key found. Set one of: {keys}")

    assert provider_name is not None
    key = os.environ.get(_KEY_ENV[provider_name])
    if not key:
        sys.exit(f"Error: {_KEY_ENV[provider_name]} is required for --provider {provider_name}")

    providers: dict[str, AiProvider] = {
        "gemini": GeminiProvider(key),
        "openai": OpenAIProvider(key),
        "anthropic": AnthropicProvider(key),
    }
    if provider_name not in providers:
        sys.exit(f"Error: unknown provider '{provider_name}'. Choose from: {', '.join(providers)}")

    return provider_name, providers[provider_name]


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _login(http: httpx.Client, base_url: str, password: str) -> str:
    resp = http.post(f"{base_url}/auth/login", json={"password": password})
    resp.raise_for_status()
    return resp.json()["csrf_token"]


def _export_page(http: httpx.Client, base_url: str, csrf: str, topic_id: int, page: int, page_size: int) -> dict[str, object]:
    resp = http.get(
        f"{base_url}/api/ai-curation/topics/{topic_id}/export",
        params={"lean": "true", "page": page, "page_size": page_size},
        headers={CSRF_HEADER_NAME: csrf},
    )
    resp.raise_for_status()
    return resp.json()


def _import(http: httpx.Client, base_url: str, csrf: str, payload: dict[str, object]) -> dict[str, object]:
    resp = http.post(
        f"{base_url}/api/ai-curation/import",
        json=payload,
        headers={CSRF_HEADER_NAME: csrf},
    )
    resp.raise_for_status()
    return resp.json()


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich topic words with AI-generated examples")
    parser.add_argument("--topic-id", type=int, required=True, help="Topic ID to enrich")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to DB")
    parser.add_argument("--live", action="store_true", help="Commit changes to the database")
    parser.add_argument("--provider", choices=["gemini", "openai", "anthropic"], help="AI provider (auto-detected from available API key, prefers cheapest)")
    parser.add_argument("--model", help="Model ID (defaults to provider's recommended cheap model)")
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--start-page", type=int, default=1, help="Resume from this page number")
    parser.add_argument("--prod-url", default="https://lexora.zuf.uk")
    args = parser.parse_args()

    if not args.live and not args.dry_run:
        print("No mode specified — defaulting to --dry-run. Use --live to commit.")
        args.dry_run = True

    dry_run = not args.live

    password = os.environ.get("PROD_PASSWORD")
    if not password:
        sys.exit("Error: PROD_PASSWORD env var is required")

    provider_name, provider = _resolve_provider(args.provider)
    model = args.model or _DEFAULT_MODELS[provider_name]

    print(f"Provider: {provider_name}  Model: {model}  Dry-run: {dry_run}")

    with httpx.Client(timeout=120) as http:
        print(f"Logging in to {args.prod_url} ...")
        csrf = _login(http, args.prod_url, password)
        print("Login OK\n")

        page = args.start_page
        total_updated = 0
        total_unchanged = 0

        while True:
            export = _export_page(http, args.prod_url, csrf, args.topic_id, page, args.page_size)
            words = cast(list[WordPayload], export.get("words", []))
            if not words:
                print("No more words.")
                break

            total_words = export.get("total_words", "?")
            offset = (page - 1) * args.page_size
            print(f"Page {page} — words {offset + 1}–{offset + len(words)} of {total_words} ...")

            word_updates = provider.enrich(model, words)

            result = _import(http, args.prod_url, csrf, {
                "source_topic_id": export["source_topic_id"],
                "exported_at": export["exported_at"],
                "dry_run": dry_run,
                "word_updates": word_updates,
            })
            total_updated += result["updated_words"]
            total_unchanged += result["unchanged"]
            print(f"  → updated={result['updated_words']}  unchanged={result['unchanged']}")

            if len(words) < args.page_size:
                break
            page += 1

    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"\n[{mode}] Done — updated: {total_updated}, unchanged: {total_unchanged}")


if __name__ == "__main__":
    main()
