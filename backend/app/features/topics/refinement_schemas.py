from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TopicAuditItem(BaseModel):
    topic_id: int
    topic_name: str
    word_count: int
    shared_word_count: int
    exclusive_word_count: int
    average_topics_per_word: float
    broadness_score: float
    reasons: list[str]
    should_review: bool

    model_config = ConfigDict(extra="forbid")


class TopicAuditResponse(BaseModel):
    items: list[TopicAuditItem]

    model_config = ConfigDict(extra="forbid")


class TopicSplitPlanRequest(BaseModel):
    max_new_topics: int = Field(default=5, ge=1, le=10)
    min_words_per_topic: int = Field(default=8, ge=1, le=50)
    include_existing_co_topics: bool = True

    model_config = ConfigDict(extra="forbid")


class ProposedSubtopic(BaseModel):
    name: str
    topic_id: int | None = None
    is_new_topic: bool
    description: str | None = None
    word_ids: list[int]
    sample_terms: list[str]
    confidence: float = Field(ge=0.0, le=1.0)

    model_config = ConfigDict(extra="forbid")


class TopicSplitPlanResponse(BaseModel):
    source_topic_id: int
    source_topic_name: str
    source_word_count: int
    should_split: bool
    reasons: list[str]
    proposed_subtopics: list[ProposedSubtopic]
    unassigned_word_ids: list[int]

    model_config = ConfigDict(extra="forbid")
