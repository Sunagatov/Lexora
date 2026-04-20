from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.words.model import Word, word_topics
from app.features.stats.model import WordProgressEvent
from app.features.stats.schemas import (
    DailyActivity, LevelCounts, StatsResponse, TopicStat, VocabularyOverview,
)


def record_level_change(
    db: Session,
    word_id: int,
    old_level: int | None,
    new_level: int,
    source: str,
) -> None:
    """Append a progress event. Does not commit — caller owns the transaction."""
    db.add(WordProgressEvent(word_id=word_id, old_level=old_level, new_level=new_level, source=source))


def _build_overview(words: list) -> tuple[VocabularyOverview, dict, int]:
    total        = len(words)
    with_example = sum(1 for w in words if w.example)
    with_pos     = sum(1 for w in words if w.part_of_speech)

    level_counts: dict[int | None, int] = defaultdict(int)
    for w in words:
        level_counts[w.knowledge_level] += 1

    active_total = sum(level_counts[l] for l in (1, 2, 3, 4))
    okay_pct = (
        round(((level_counts[3] + level_counts[4]) / active_total) * 100)
        if active_total > 0 else 0
    )

    overview = VocabularyOverview(
        total_words=total,
        total_topics=0,  # filled by caller
        with_example=with_example,
        with_pos=with_pos,
        missing_example=total - with_example,
        missing_pos=total - with_pos,
        needs_enrichment=sum(1 for w in words if not w.example or not w.part_of_speech),
    )
    return overview, level_counts, okay_pct


def _build_topic_stats(db: Session, topics: list, word_map: dict) -> list[TopicStat]:
    rows = db.execute(select(word_topics.c.topic_id, word_topics.c.word_id)).all()
    topic_word_ids: dict[int, list[int]] = defaultdict(list)
    for topic_id, word_id in rows:
        if word_id in word_map:
            topic_word_ids[topic_id].append(word_id)

    result: list[TopicStat] = []
    for t in topics:
        tw = [word_map[wid] for wid in topic_word_ids.get(t.id, [])]
        if not tw:
            continue
        score_sum, active_count, weak_count, strong_count = 0.0, 0, 0, 0
        for w in tw:
            lvl = w.knowledge_level
            if lvl and 1 <= lvl <= 4:
                score_sum += (lvl - 1) / 3
                active_count += 1
                if lvl <= 2:
                    weak_count += 1
                else:
                    strong_count += 1
        progress = round((score_sum / active_count) * 100) if active_count > 0 else 0
        result.append(TopicStat(
            id=t.id, name=t.name, slug=t.slug, total=len(tw),
            progress=progress, weak_count=weak_count, strong_count=strong_count,
            missing_example=sum(1 for w in tw if not w.example),
            missing_pos=sum(1 for w in tw if not w.part_of_speech),
        ))
    result.sort(key=lambda t: t.progress)
    return result


def _build_words_added_by_month(words: list) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for w in words:
        key = f"{w.created_at.year}-{w.created_at.month:02d}"
        counts[key] += 1
    return dict(sorted(counts.items()))


def _build_daily_activity(db: Session) -> tuple[list[DailyActivity], str | None]:
    events = db.scalars(
        select(WordProgressEvent).order_by(WordProgressEvent.created_at.asc())
    ).all()

    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"reviewed": 0, "improved": 0, "downgraded": 0})
    seen_per_day: dict[str, set[int]] = defaultdict(set)
    for e in events:
        day = e.created_at.strftime("%Y-%m-%d")
        if e.word_id not in seen_per_day[day]:
            daily[day]["reviewed"] += 1
            seen_per_day[day].add(e.word_id)
        old = e.old_level or 0
        if e.new_level > old:
            daily[day]["improved"] += 1
        elif e.new_level < old:
            daily[day]["downgraded"] += 1

    activity = [
        DailyActivity(
            date=day,
            reviewed=v["reviewed"],
            improved=v["improved"],
            downgraded=v["downgraded"],
            net=v["improved"] - v["downgraded"],
        )
        for day, v in sorted(daily.items(), reverse=True)
    ]
    tracking_started_at = min(daily.keys()) if daily else None
    return activity, tracking_started_at


def compute_stats(db: Session) -> StatsResponse:
    words  = db.scalars(select(Word).where(Word.deleted_at.is_(None))).all()
    topics = db.scalars(select(Topic).where(Topic.deleted_at.is_(None))).all()

    overview, level_counts, okay_pct = _build_overview(words)
    overview = overview.model_copy(update={"total_topics": len(topics)})

    word_map     = {w.id: w for w in words}
    topic_stats  = _build_topic_stats(db, topics, word_map)
    words_by_month = _build_words_added_by_month(words)
    daily_activity, tracking_started_at = _build_daily_activity(db)

    return StatsResponse(
        overview=overview,
        level_counts=LevelCounts(
            unset=level_counts[None],
            level_1=level_counts[1],
            level_2=level_counts[2],
            level_3=level_counts[3],
            level_4=level_counts[4],
            level_5=level_counts[5],
        ),
        okay_or_better_pct=okay_pct,
        topics=topic_stats,
        daily_activity=daily_activity,
        words_added_by_month=words_by_month,
        tracking_started_at=tracking_started_at,
    )
