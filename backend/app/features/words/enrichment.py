from __future__ import annotations

from typing import Literal

EXAMPLE_TARGET_COUNT = 3
ExampleEnrichmentStatus = Literal["missing", "partial", "complete"]


def example_count(word: object) -> int:
    items = getattr(word, "example_items", None)
    if items is not None:
        return len(items or [])
    return 0


def example_enrichment_status(count: int) -> ExampleEnrichmentStatus:
    if count <= 0:
        return "missing"
    if count < EXAMPLE_TARGET_COUNT:
        return "partial"
    return "complete"


def needs_example_enrichment(word: object) -> bool:
    return example_count(word) < EXAMPLE_TARGET_COUNT
