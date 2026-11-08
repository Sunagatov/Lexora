from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.smart_review.lifecycle import complete_queue_item
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.stats.service import compute_stats
from app.features.topics.model import Topic  # noqa: F401 - register relationships
from app.features.words.model import Word
from app.features.words.progress import WordProgressEvent
from app.features.words.repository import update_word
from app.features.words.schemas import WordUpdate
from app.shared.db import Base


@pytest.fixture
def db():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_retention_counts_only_current_words_but_keeps_historical_activity(db):
    words = [Word(term='one'), Word(term='two'), Word(term='unreviewed')]
    db.add_all(words)
    db.flush()
    for word in words[:2]:
        db.add(WordProgressEvent(word_id=word.id, old_level=1, new_level=3, source='manual'))
    words[1].deleted_at = datetime.now(UTC)
    db.commit()
    stats = compute_stats(db)
    assert stats.overview.total_words == 2
    assert stats.retention_summary.reviewed_words == 1
    assert stats.retention_summary.never_reviewed_words == 1
    assert stats.retention_summary.reviewed_word_share_pct == 50
    assert stats.daily_activity[0].reviewed == 2


def test_stats_after_generating_daily_mix_in_sqlite(db):
    db.add(StudyQueue(total_count=1, completed_count=0,
                      expires_at=datetime.now(UTC) + timedelta(hours=24)))
    db.commit()
    db.expunge_all()
    assert compute_stats(db).queue_summary.active_queues == 1


@pytest.mark.parametrize('source, expected', [('smart_review', 1), ('study_list', 1), ('manual', 0)])
def test_unchanged_rating_counts_study_activity_without_improvement(db, source, expected):
    word = Word(term='one', knowledge_level=3)
    queue = StudyQueue(total_count=1, completed_count=0,
                       expires_at=datetime.now(UTC) + timedelta(hours=24))
    db.add_all([word, queue])
    db.flush()
    item = StudyQueueItem(queue_id=queue.id, word_id=word.id, position=0)
    db.add(item)
    db.commit()
    update_word(db, word, WordUpdate(knowledge_level=3, progress_source=source))
    assert complete_queue_item(db, item.id).completed_count == 1
    stats = compute_stats(db)
    assert stats.retention_summary.reviewed_words == expected
    assert stats.retention_summary.improved_words == 0
    assert stats.retention_summary.regressed_words == 0
    assert stats.efficiency_summary.total_review_events == expected
