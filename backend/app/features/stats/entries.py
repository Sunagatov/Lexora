from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.features.languages.catalog import learning_language, translation_language
from app.features.stats.schemas import StatsEntry, StatsEntryPage
from app.features.topics.model import Topic
from app.features.words.api import with_word_details
from app.features.words.constants import STUDY_PROGRESS_SOURCES
from app.features.words.enrichment import EXAMPLE_TARGET_COUNT
from app.features.words.model import Word, WordExample, WordTranslation, word_topics
from app.features.words.progress import WordProgressEvent
from app.features.words.schemas import WordResponse

LibraryGap = Literal["translation", "no-examples", "needs-examples", "no-topic", "multiple-topics"]
RevisitGroup = Literal["weak", "downgraded", "unreviewed"]


def _active_entries(db: Session) -> Select:
    return select(Word.id, Word.term, Word.knowledge_level).where(
        Word.deleted_at.is_(None), Word.language == learning_language(db)
    )


def _entry_page(db: Session, stmt: Select, page: int) -> StatsEntryPage:
    size = 20
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.order_by(func.lower(Word.term), Word.id).limit(size).offset((page - 1) * size))
    return StatsEntryPage(
        entries=[StatsEntry(id=id_, term=term, knowledge_level=level) for id_, term, level in rows],
        total=total,
        has_more=page * size < total,
    )


def list_library_gap(db: Session, gap: LibraryGap, page: int) -> StatsEntryPage:
    stmt = _active_entries(db)
    match gap:
        case "translation":
            predicate = ~Word.translation_items.any(WordTranslation.language == translation_language(db))
        case "no-examples":
            predicate = ~Word.example_items.any()
        case "needs-examples":
            count = select(func.count()).where(WordExample.word_id == Word.id).scalar_subquery()
            predicate = count < EXAMPLE_TARGET_COUNT
        case "no-topic" | "multiple-topics":
            count = (
                select(func.count()).select_from(word_topics)
                .join(Topic, Topic.id == word_topics.c.topic_id)
                .where(
                    word_topics.c.word_id == Word.id, Topic.deleted_at.is_(None),
                    Topic.language == learning_language(db),
                ).scalar_subquery()
            )
            predicate = count == 0 if gap == "no-topic" else count > 1
    return _entry_page(db, stmt.where(predicate), page)


def _revisit_entries(db: Session, group: RevisitGroup) -> Select:
    stmt = _active_entries(db)
    match group:
        case "weak":
            stmt = stmt.where(Word.knowledge_level == 1)
        case "unreviewed":
            stmt = stmt.where(
                or_(Word.knowledge_level.is_(None), Word.knowledge_level != 5),
                ~Word.progress_events.any(WordProgressEvent.source.in_(STUDY_PROGRESS_SOURCES)),
            )
        case "downgraded":
            cutoff = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
            regressed_ids = (
                select(WordProgressEvent.word_id)
                .where(
                    WordProgressEvent.source.in_(STUDY_PROGRESS_SOURCES), WordProgressEvent.created_at >= cutoff,
                    WordProgressEvent.old_level.between(1, 4), WordProgressEvent.new_level.between(1, 3),
                    WordProgressEvent.new_level < WordProgressEvent.old_level,
                    or_(WordProgressEvent.old_level != 3, WordProgressEvent.new_level != 2),
                )
                .group_by(WordProgressEvent.word_id)
                .having(func.count() >= 2)
            )
            stmt = stmt.where(
                or_(Word.knowledge_level.is_(None), Word.knowledge_level != 5), Word.id.in_(regressed_ids),
            )
    return stmt


def list_revisit_words(db: Session, group: RevisitGroup, page: int) -> StatsEntryPage:
    return _entry_page(db, _revisit_entries(db, group), page)


def load_revisit_practice(db: Session, group: RevisitGroup, page: int) -> list[WordResponse]:
    target = translation_language(db)
    review_ids = (
        _revisit_entries(db, group)
        .with_only_columns(Word.id)
        .order_by(func.lower(Word.term), Word.id)
        .limit(20)
        .offset((page - 1) * 20)
    )
    words = db.scalars(with_word_details(
        select(Word)
        .where(Word.id.in_(review_ids), Word.translation_items.any(WordTranslation.language == target))
        .order_by(func.lower(Word.term), Word.id)
        .limit(10)
    ))
    return [WordResponse.from_word(word) for word in words]
