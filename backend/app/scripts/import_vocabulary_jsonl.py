"""Import vocabulary from a JSONL file directly into the database.

Usage:
    cd backend
    python3 -m app.scripts.import_vocabulary_jsonl <path_to_jsonl>
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

from app.shared.db import SessionLocal
from app.features.words.bulk.service import bulk_import
from app.features.words.schemas import WordBulkCreate, WordInput, VerbFormData


def load_jsonl(path: Path) -> list[dict]:
    words = []
    with open(path) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                words.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"  ERROR line {i}: {e}")
                sys.exit(1)
    return words


def to_word_input(w: dict) -> WordInput:
    verb_form = None
    if w.get("verb_form"):
        verb_form = VerbFormData(**w["verb_form"])
    return WordInput(
        term=w["term"],
        language=w.get("language", "en"),
        definition=w.get("definition"),
        pronunciation_ipa=w.get("pronunciation_ipa"),
        part_of_speech=w.get("part_of_speech"),
        cefr_level=w.get("cefr_level"),
        register=w.get("register"),
        countability=w.get("countability"),
        frequency_rank=w.get("frequency_rank"),
        pattern=w.get("pattern"),
        notes=w.get("notes"),
        translation_entries=w.get("translation_entries"),
        example_entries=w.get("example_entries"),
        verb_form=verb_form,
    )


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 -m app.scripts.import_vocabulary_jsonl <file.jsonl>")
        sys.exit(1)

    path = Path(sys.argv[1])
    print(f"Loading {path}...")
    raw = load_jsonl(path)

    groups: dict[str, list[dict]] = defaultdict(list)
    for w in raw:
        groups[w["topic_name"]].append(w)

    print(f"Found {len(raw)} words across {len(groups)} topics\n")

    with SessionLocal() as db:
        for topic_name in sorted(groups):
            words = groups[topic_name]
            print(f"Importing '{topic_name}' ({len(words)} words)...")
            payload = WordBulkCreate(
                topic_name=topic_name,
                words=[to_word_input(w) for w in words],
            )
            result = bulk_import(db, payload)
            print(f"  ✓ added={result.added}, skipped={result.skipped}")

    print("\nDone!")


if __name__ == "__main__":
    main()
