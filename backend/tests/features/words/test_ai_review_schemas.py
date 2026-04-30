from typing import cast

import pytest
from pydantic import ValidationError

from app.features.words.constants import PROGRESS_SOURCE_JSON_IMPORT
from app.features.words.ai_review.schemas import AiReviewImportRequest, AiReviewImportWord
from app.features.words.schemas import WordUpdate


def _bad_review_words(data: list[dict[str, object]]) -> list[AiReviewImportWord]:
    return cast(list[AiReviewImportWord], data)


def test_ai_review_import_allows_clean_example_enrichment() -> None:
    words = [
        AiReviewImportWord(
            id=10,
            term="mortgage",
            translations="ипотека",
            translation_entries=["ипотека"],
            example_entries=[
                "They applied for a mortgage last month.",
                "The mortgage payment is due tomorrow.",
                "Higher rates made the mortgage more expensive.",
            ],
            part_of_speech="noun",
            countability="Countable",
        )
    ]
    payload = AiReviewImportRequest(
        topic_id=1,
        dry_run=False,
        words=words,
    )

    assert payload.schema_version == "lexora.ai-review.v1"
    assert payload.words[0].example_entries == [
        "They applied for a mortgage last month.",
        "The mortgage payment is due tomorrow.",
        "Higher rates made the mortgage more expensive.",
    ]


def test_ai_review_import_rejects_unknown_countability() -> None:
    words = _bad_review_words([{"id": 10, "term": "cash", "countability": "Sometimes"}])
    with pytest.raises(ValidationError):
        AiReviewImportRequest(
            topic_id=1,
            words=words,
        )


def test_ai_review_import_rejects_explicit_null_translations() -> None:
    words = _bad_review_words([{"id": 10, "term": "cash", "translations": None}])
    with pytest.raises(ValidationError):
        AiReviewImportRequest(
            topic_id=1,
            words=words,
        )


def test_word_update_accepts_json_import_progress_source() -> None:
    payload = WordUpdate(knowledge_level=3, progress_source=PROGRESS_SOURCE_JSON_IMPORT)

    assert payload.progress_source == PROGRESS_SOURCE_JSON_IMPORT
