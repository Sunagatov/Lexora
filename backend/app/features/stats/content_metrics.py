from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.features.stats.schemas import EnrichmentCoverage, TopicStat, VocabProfileSummary, VocabularyOverview
from app.features.topics.model import Topic
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT, example_count
from app.features.words.model import Word, word_topics


@dataclass(frozen=True)
class WordStatsSnapshot:
    id: int
    knowledge_level: int | None
    has_pos: bool
    example_items: tuple[object, ...]
    created_at: datetime
    source: str = "manual"
    pos_name: str | None = None
    cefr_level: str | None = None
    register: str | None = None
    has_definition: bool = False
    has_ipa: bool = False
    translation_count: int = 0
    synonym_count: int = 0
    antonym_count: int = 0
    collocation_count: int = 0
    confusable_count: int = 0


def _build_overview(words: list[WordStatsSnapshot]) -> tuple[VocabularyOverview, dict[int | None, int], int]:
    total = len(words)
    example_counts = [example_count(word) for word in words]
    with_example = sum(1 for count in example_counts if count > 0)
    with_examples_3plus = sum(1 for count in example_counts if count >= EXAMPLE_TARGET_COUNT)
    with_pos = sum(1 for word in words if word.has_pos)

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
        needs_enrichment=sum(1 for word in words if not word.example_items or not word.has_pos),
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
                missing_example=sum(1 for word in words if not word.example_items),
                needs_example_enrichment=sum(1 for word in words if example_count(word) < EXAMPLE_TARGET_COUNT),
                missing_pos=sum(1 for word in words if not word.has_pos),
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
        if word.source != "manual":
            continue
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
        with_translation=sum(1 for w in words if w.translation_count > 0),
        with_examples=sum(1 for w in words if w.example_items),
        with_synonyms=sum(1 for w in words if w.synonym_count > 0),
        with_antonyms=sum(1 for w in words if w.antonym_count > 0),
        with_collocations=sum(1 for w in words if w.collocation_count > 0),
        with_confusables=sum(1 for w in words if w.confusable_count > 0),
        with_cefr=sum(1 for w in words if w.cefr_level),
        with_register=sum(1 for w in words if w.register),
    )


def list_active_word_stats(db: Session) -> list[WordStatsSnapshot]:
    words = db.scalars(
        select(Word).options(
            selectinload(Word.example_items),
            selectinload(Word.part_of_speech),
            selectinload(Word.translation_items),
            selectinload(Word.synonym_items),
            selectinload(Word.antonym_items),
            selectinload(Word.collocation_items),
            selectinload(Word.confusable_items),
        ).where(Word.deleted_at.is_(None))
    ).all()
    return [
        WordStatsSnapshot(
            id=int(word.id),
            knowledge_level=word.knowledge_level,
            has_pos=word.part_of_speech_id is not None,
            pos_name=word.part_of_speech.name if word.part_of_speech else None,
            example_items=tuple(getattr(word, "example_items", ()) or ()),
            created_at=word.created_at,
            source=word.source,
            cefr_level=word.cefr_level,
            register=word.register,
            has_definition=bool(word.definition),
            has_ipa=bool(word.pronunciation_ipa),
            translation_count=len(word.translation_items),
            synonym_count=len(word.synonym_items),
            antonym_count=len(word.antonym_items),
            collocation_count=len(word.collocation_items),
            confusable_count=len(word.confusable_items),
        )
        for word in words
    ]


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
