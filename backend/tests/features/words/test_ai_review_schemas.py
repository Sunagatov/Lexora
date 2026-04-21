import pytest
from pydantic import ValidationError

from app.features.words.ai_review.schemas import AiReviewImportRequest
from app.features.words.schemas import WordUpdate


def test_ai_review_import_allows_clean_example_enrichment() -> None:
    payload = AiReviewImportRequest(
        mode="enrich_existing_words_only",
        topic_id=1,
        topic={"id": 1, "name": "Banking"},
        pagination={"page": 1, "page_size": 50, "total_words": 1, "total_pages": 1},
        allowed_values={"countability": ["Countable"], "part_of_speech": ["noun"]},
        instructions=["Keep ids unchanged."],
        words=[
            {
                "id": 10,
                "term": "mortgage",
                "example_entries": [
                    "They applied for a mortgage last month.",
                    "The mortgage payment is due tomorrow.",
                    "Higher rates made the mortgage more expensive.",
                ],
                "part_of_speech": "noun",
                "countability": "Countable",
            }
        ],
    )

    assert payload.schema_version == "lexora.ai-review.v1"
    assert payload.words[0].example_entries == [
        "They applied for a mortgage last month.",
        "The mortgage payment is due tomorrow.",
        "Higher rates made the mortgage more expensive.",
    ]


def test_ai_review_import_rejects_unknown_countability() -> None:
    with pytest.raises(ValidationError):
        AiReviewImportRequest(
            topic_id=1,
            words=[{"id": 10, "term": "cash", "countability": "Sometimes"}],
        )


def test_word_update_accepts_json_import_progress_source() -> None:
    payload = WordUpdate(knowledge_level=3, progress_source="json_import")

    assert payload.progress_source == "json_import"
