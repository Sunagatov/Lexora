from __future__ import annotations

from typing import Literal

EXAMPLE_TARGET_COUNT = 3
ExampleEnrichmentStatus = Literal["missing", "partial", "complete"]


def example_count(word: object) -> int:
    items = getattr(word, "example_items", None)
    if items is not None:
        return len(items or [])

    raw = getattr(word, "example", None)
    if raw is None:
        return 0
    if not isinstance(raw, str):
        raw = str(raw)
    normalized = raw.replace("\r\n", "\n").replace("\r", "\n")
    return len([line for line in normalized.split("\n") if line.strip()])


def example_enrichment_status(count: int) -> ExampleEnrichmentStatus:
    if count <= 0:
        return "missing"
    if count < EXAMPLE_TARGET_COUNT:
        return "partial"
    return "complete"


def needs_example_enrichment(word: object) -> bool:
    return example_count(word) < EXAMPLE_TARGET_COUNT
