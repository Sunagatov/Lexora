from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.languages.catalog import learning_language
from app.features.stats.schemas import (
    EnrichmentCoverage,
    LibraryTopicStat,
    TopicStat,
    VocabProfileSummary,
    VocabularyOverview,
)
from app.features.topics.model import Topic
from app.features.words.constants import STUDY_PROGRESS_SOURCES
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT
from app.features.words.model import PartsOfSpeech, Word, WordExample, WordTranslation, word_topics
from app.features.words.progress import WordProgressEvent


@dataclass(frozen=True)
class WordStatsSnapshot:
    id: int
    knowledge_level: int | None
    has_pos: bool
    example_count: int
    created_at: datetime
    pos_name: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    has_definition: bool = False
    has_ipa: bool = False
    has_translation: bool = False
    has_synonym: bool = False
    has_antonym: bool = False
    has_collocation: bool = False
    has_confusable: bool = False
    has_study_review: bool = False


def _build_library_overview(words: list[WordStatsSnapshot], total_topics: int = 0) -> VocabularyOverview:
    total = len(words)
    example_counts = [word.example_count for word in words]
    with_example = sum(1 for count in example_counts if count > 0)
    with_examples_3plus = sum(1 for count in example_counts if count >= EXAMPLE_TARGET_COUNT)
    with_pos = sum(1 for word in words if word.has_pos)

    return VocabularyOverview(
        total_words=total,
        total_topics=total_topics,
        with_example=with_example,
        with_examples_3plus=with_examples_3plus,
        with_pos=with_pos,
        missing_example=total - with_example,
        needs_example_enrichment=total - with_examples_3plus,
        missing_pos=total - with_pos,
        needs_enrichment=sum(1 for word in words if not word.example_count or not word.has_pos),
    )


def okay_or_better_pct(level_counts: Mapping[int | None, int]) -> int:
    okay_or_strong = level_counts.get(3, 0) + level_counts.get(4, 0)
    active_total = okay_or_strong + level_counts.get(1, 0)
    return round(okay_or_strong / active_total * 100) if active_total else 0


def _build_overview(words: list[WordStatsSnapshot]) -> tuple[VocabularyOverview, dict[int | None, int], int]:
    level_counts: dict[int | None, int] = defaultdict(int)
    for word in words:
        level_counts[word.knowledge_level] += 1
    return _build_library_overview(words), level_counts, okay_or_better_pct(level_counts)


def _build_topic_stats(
    db: Session,
    topics: list[Topic],
    word_map: dict[int, WordStatsSnapshot],
    reviewed_word_ids: set[int],
    regressed_word_ids: set[int],
) -> list[TopicStat]:
    topic_word_ids = roll_up_topic_words(topics, _load_topic_word_ids(db, word_map))

    result: list[TopicStat] = []
    for topic in topics:
        words = [word_map[word_id] for word_id in topic_word_ids.get(topic.id, set())]
        if not words:
            continue

        progress, weak_count, strong_count = _summarize_topic_progress(words)
        topic_word_id_list = topic_word_ids.get(topic.id, set())
        reviewed_count = sum(1 for word_id in topic_word_id_list if word_id in reviewed_word_ids)
        regressed_count = sum(1 for word_id in topic_word_id_list if word_id in regressed_word_ids)
        result.append(
            TopicStat(
                **build_library_topic(topic, words).model_dump(),
                progress=progress,
                weak_count=weak_count,
                strong_count=strong_count,
                reviewed_count=reviewed_count,
                regressed_count=regressed_count,
                never_reviewed_count=max(0, len(words) - reviewed_count),
            )
        )

    result.sort(key=lambda topic: topic.progress)
    return result


def roll_up_topic_words(topics: list[Topic], direct_links: dict[int, list[int]]) -> dict[int, set[int]]:
    parents = {topic.id: topic.parent_topic_id for topic in topics}
    topic_word_ids: dict[int, set[int]] = defaultdict(set)
    for topic_id, word_ids in direct_links.items():
        seen: set[int] = set()
        current_id = topic_id
        while current_id in parents and current_id not in seen:
            seen.add(current_id)
            topic_word_ids[current_id].update(word_ids)
            current_id = parents[current_id]
    return topic_word_ids


def build_library_topic(topic: Topic, words: list[WordStatsSnapshot]) -> LibraryTopicStat:
    return LibraryTopicStat(
        id=topic.id,
        name=topic.name,
        slug=topic.slug,
        total=len(words),
        missing_example=sum(1 for word in words if not word.example_count),
        needs_example_enrichment=sum(1 for word in words if word.example_count < EXAMPLE_TARGET_COUNT),
        missing_pos=sum(1 for word in words if not word.has_pos),
    )


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
        if level not in (1, 3, 4):
            continue
        score_sum += (level - 1) / 3
        active_count += 1
        if level == 1:
            weak_count += 1
        else:
            strong_count += 1

    progress = round((score_sum / active_count) * 100) if active_count > 0 else 0
    return progress, weak_count, strong_count


def _build_vocab_profile(words: list[WordStatsSnapshot]) -> VocabProfileSummary:
    cefr: dict[str, int] = defaultdict(int)
    register: dict[str, int] = defaultdict(int)
    pos: dict[str, int] = defaultdict(int)
    for w in words:
        cefr[w.cefr_level or "unknown"] += 1
        register[w.register or "unknown"] += 1
        pos[w.pos_name or "unknown"] += 1
    return VocabProfileSummary(cefr_distribution=dict(cefr), register_distribution=dict(register), pos_distribution=dict(pos))


def _build_enrichment_coverage(words: list[WordStatsSnapshot]) -> EnrichmentCoverage:
    total = len(words)
    return EnrichmentCoverage(
        total_words=total,
        with_definition=sum(1 for w in words if w.has_definition),
        with_ipa=sum(1 for w in words if w.has_ipa),
        with_translation=sum(1 for w in words if w.has_translation),
        with_examples=sum(1 for w in words if w.example_count),
        with_synonyms=sum(1 for w in words if w.has_synonym),
        with_antonyms=sum(1 for w in words if w.has_antonym),
        with_collocations=sum(1 for w in words if w.has_collocation),
        with_confusables=sum(1 for w in words if w.has_confusable),
        with_cefr=sum(1 for w in words if w.cefr_level),
        with_register=sum(1 for w in words if w.register),
    )


def list_active_word_stats(
    db: Session, *, translations: str | None = None, include_study_coverage: bool = False
) -> list[WordStatsSnapshot]:
    translation = (
        Word.translation_items.any()
        if translations is None
        else Word.translation_items.any(WordTranslation.language == translations)
    )
    example_count = select(func.count()).where(WordExample.word_id == Word.id).scalar_subquery()
    study_coverage = (
        [Word.progress_events.any(WordProgressEvent.source.in_(STUDY_PROGRESS_SOURCES)).label("has_study_review")]
        if include_study_coverage
        else []
    )
    rows = db.execute(
        select(
            Word.id,
            Word.knowledge_level,
            Word.part_of_speech_id.is_not(None).label("has_pos"),
            example_count.label("example_count"),
            Word.created_at,
            PartsOfSpeech.name.label("pos_name"),
            Word.cefr_level,
            Word.register,
            (func.coalesce(Word.definition, "") != "").label("has_definition"),
            (func.coalesce(Word.pronunciation_ipa, "") != "").label("has_ipa"),
            translation.label("has_translation"),
            Word.synonym_items.any().label("has_synonym"),
            Word.antonym_items.any().label("has_antonym"),
            Word.collocation_items.any().label("has_collocation"),
            Word.confusable_items.any().label("has_confusable"),
            *study_coverage,
        )
        .outerjoin(PartsOfSpeech, PartsOfSpeech.id == Word.part_of_speech_id)
        .where(Word.deleted_at.is_(None), Word.language == learning_language(db))
    )
    return [WordStatsSnapshot(**row) for row in rows.mappings()]


def load_active_library_topic_word_ids(
    db: Session, words: dict[int, WordStatsSnapshot]
) -> dict[int, list[int]]:
    if not words:
        return {}
    rows = db.execute(
        select(word_topics.c.topic_id, word_topics.c.word_id)
        .join(Word, Word.id == word_topics.c.word_id)
        .join(Topic, Topic.id == word_topics.c.topic_id)
        .where(Word.language == learning_language(db), Word.deleted_at.is_(None))
        .where(Topic.language == Word.language, Topic.deleted_at.is_(None))
    )
    topic_word_ids: dict[int, list[int]] = {}
    for topic_id, word_id in rows:
        if word_id in words:
            topic_word_ids.setdefault(topic_id, []).append(word_id)
    return topic_word_ids


def load_topic_word_ids(db: Session, word_ids: set[int] | list[int]) -> dict[int, list[int]]:
    if not word_ids:
        return {}

    rows = db.execute(
        select(word_topics.c.topic_id, word_topics.c.word_id).where(word_topics.c.word_id.in_(word_ids))
    ).all()
    topic_word_ids: dict[int, list[int]] = {}
    for topic_id, word_id in rows:
        topic_word_ids.setdefault(int(topic_id), []).append(int(word_id))
    return topic_word_ids
