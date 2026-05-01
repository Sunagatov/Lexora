from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.features.stats.schemas import TopicStat, VocabularyOverview
from app.features.topics.model import Topic
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count
from app.features.words.repository import WordStatsSnapshot, load_topic_word_ids


def _build_overview(words: list[WordStatsSnapshot]) -> tuple[VocabularyOverview, dict[int | None, int], int]:
    total = len(words)
    example_counts = [example_count(word) for word in words]
    with_example = sum(1 for count in example_counts if count > 0)
    with_examples_3plus = sum(1 for count in example_counts if count >= EXAMPLE_TARGET_COUNT)
    with_pos = sum(1 for word in words if word.part_of_speech)

    level_counts: dict[int | None, int] = defaultdict(int)
    for word in words:
        level_counts[word.knowledge_level] += 1

    active_total = sum(level_counts[level] for level in (1, 2, 3, 4))
    okay_pct = round(((level_counts[3] + level_counts[4]) / active_total) * 100) if active_total > 0 else 0

    overview = VocabularyOverview(
        total_words=total,
        total_topics=0,
        with_example=with_example,
        with_examples_3plus=with_examples_3plus,
        with_pos=with_pos,
        missing_example=total - with_example,
        needs_example_enrichment=total - with_examples_3plus,
        missing_pos=total - with_pos,
        needs_enrichment=sum(1 for word in words if not word.example or not word.part_of_speech),
    )
    return overview, level_counts, okay_pct


def _build_topic_stats(
    db: Session,
    topics: list[Topic],
    word_map: dict[int, WordStatsSnapshot],
    reviewed_word_ids: set[int],
    regressed_word_ids: set[int],
) -> list[TopicStat]:
    topic_word_ids = _load_topic_word_ids(db, word_map)

    result: list[TopicStat] = []
    for topic in topics:
        words = [word_map[word_id] for word_id in topic_word_ids.get(topic.id, [])]
        if not words:
            continue

        progress, weak_count, strong_count = _summarize_topic_progress(words)
        topic_word_id_list = topic_word_ids.get(topic.id, [])
        reviewed_count = sum(1 for word_id in topic_word_id_list if word_id in reviewed_word_ids)
        regressed_count = sum(1 for word_id in topic_word_id_list if word_id in regressed_word_ids)
        result.append(
            TopicStat(
                id=topic.id,
                name=topic.name,
                slug=topic.slug,
                total=len(words),
                progress=progress,
                weak_count=weak_count,
                strong_count=strong_count,
                missing_example=sum(1 for word in words if not word.example),
                needs_example_enrichment=sum(1 for word in words if example_count(word) < EXAMPLE_TARGET_COUNT),
                missing_pos=sum(1 for word in words if not word.part_of_speech),
                reviewed_count=reviewed_count,
                regressed_count=regressed_count,
                never_reviewed_count=max(0, len(words) - reviewed_count),
            )
        )

    result.sort(key=lambda topic: topic.progress)
    return result


def _build_words_added_by_month(words: list[WordStatsSnapshot]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for word in words:
        key = f"{word.created_at.year}-{word.created_at.month:02d}"
        counts[key] += 1
    return dict(sorted(counts.items()))


def _load_topic_word_ids(db: Session, word_map: dict[int, WordStatsSnapshot]) -> dict[int, list[int]]:
    if not word_map:
        return {}
    return load_topic_word_ids(db, set(word_map))


def _summarize_topic_progress(words: list[WordStatsSnapshot]) -> tuple[int, int, int]:
    score_sum = 0.0
    active_count = 0
    weak_count = 0
    strong_count = 0

    for word in words:
        level = word.knowledge_level
        if level is None or not 1 <= level <= 4:
            continue
        score_sum += (level - 1) / 3
        active_count += 1
        if level <= 2:
            weak_count += 1
        else:
            strong_count += 1

    progress = round((score_sum / active_count) * 100) if active_count > 0 else 0
    return progress, weak_count, strong_count
