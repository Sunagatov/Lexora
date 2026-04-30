from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.features.topics.repository import get_all_topics_with_words
from app.features.topics.refinement_clusters import (
    GENERIC_NAME_TOKENS,
    TOPIC_SPLIT_MIN_WORDS,
    _active_topics,
    _is_parts_of_speech_topic,
    _tokenize,
)
from app.features.topics.refinement_schemas import TopicAuditItem, TopicAuditResponse


def _topic_audit(topic) -> TopicAuditItem:
    words = [word for word in getattr(topic, "words", []) if getattr(word, "deleted_at", None) is None]
    word_count = len(words)
    if word_count == 0:
        return TopicAuditItem(
            topic_id=topic.id,
            topic_name=topic.name,
            word_count=0,
            shared_word_count=0,
            exclusive_word_count=0,
            average_topics_per_word=0.0,
            broadness_score=0.0,
            reasons=["empty topic"],
            should_review=False,
        )
    if _is_parts_of_speech_topic(topic.name):
        return TopicAuditItem(
            topic_id=topic.id,
            topic_name=topic.name,
            word_count=word_count,
            shared_word_count=sum(1 for word in words if len(_active_topics(word)) > 1),
            exclusive_word_count=sum(1 for word in words if len(_active_topics(word)) == 1),
            average_topics_per_word=round(
                sum(len(_active_topics(word)) for word in words) / word_count,
                2,
            ),
            broadness_score=0.0,
            reasons=["part-of-speech umbrella topic"],
            should_review=False,
        )

    shared_word_count = sum(1 for word in words if len(_active_topics(word)) > 1)
    active_topic_refs = sum(len(_active_topics(word)) for word in words)
    average_topics_per_word = active_topic_refs / word_count
    shared_ratio = shared_word_count / word_count

    reasons: list[str] = []
    score = 0.0
    if word_count >= 120:
        score += 0.45
        reasons.append(f"large topic: {word_count} words")
    elif word_count >= 80:
        score += 0.3
        reasons.append(f"broad topic size: {word_count} words")
    elif word_count >= 50:
        score += 0.15
        reasons.append(f"moderately large topic: {word_count} words")

    topic_tokens = _tokenize(topic.name)
    if topic_tokens & GENERIC_NAME_TOKENS:
        score += 0.3
        reasons.append("generic topic name")
    if len(topic.name.split()) >= 4:
        score += 0.1
        reasons.append("compound topic name")
    if shared_ratio >= 0.5:
        score += 0.2
        reasons.append("many words already shared with other topics")
    elif shared_ratio >= 0.25:
        score += 0.1
        reasons.append("some words already shared with other topics")
    if average_topics_per_word >= 2.5:
        score += 0.15
        reasons.append("words belong to several topics on average")
    if word_count > TOPIC_SPLIT_MIN_WORDS:
        score += 0.25
        reasons.append(f"meets the >{TOPIC_SPLIT_MIN_WORDS} word split threshold")

    score = min(score, 1.0)
    should_review = word_count > TOPIC_SPLIT_MIN_WORDS

    return TopicAuditItem(
        topic_id=topic.id,
        topic_name=topic.name,
        word_count=word_count,
        shared_word_count=shared_word_count,
        exclusive_word_count=word_count - shared_word_count,
        average_topics_per_word=round(average_topics_per_word, 2),
        broadness_score=round(score, 2),
        reasons=reasons or ["topic looks focused"],
        should_review=should_review,
    )


def build_topic_audit(
    db: Session,
    *,
    get_all_topics_with_words_fn: Callable[[Session], list] | None = None,
) -> TopicAuditResponse:
    topic_loader = get_all_topics_with_words_fn or get_all_topics_with_words
    topics = topic_loader(db)
    items = [_topic_audit(topic) for topic in topics]
    items.sort(key=lambda item: (-int(item.should_review), -item.broadness_score, -item.word_count, item.topic_name.casefold()))
    return TopicAuditResponse(items=items)
