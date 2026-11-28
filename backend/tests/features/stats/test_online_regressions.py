from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, event, null
from sqlalchemy.orm import Session

from app.features.languages.catalog import configure_language
from app.features.smart_review.lifecycle import complete_queue_item
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.stats import router as stats_router
from app.features.stats import service as stats_service
from app.features.stats.model import AppUsageEvent
from app.features.stats.service import compute_stats
from app.features.topics.model import Topic
from app.features.words.model import Word, WordExample, WordTranslation
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


def test_revisit_practice_loads_at_most_ten_translated_words_from_the_selected_group(db):
    db.add_all([
        Word(term=f'practice-{i:02}', knowledge_level=1, translation_items=[
            WordTranslation(position=0, value=f'answer-{i}', language='en'),
        ]) for i in range(12)
    ])
    db.add_all([
        Word(term='a-junk', knowledge_level=1),
        Word(term='a-parked', knowledge_level=5, translation_items=[WordTranslation(position=0, value='answer', language='en')]),
        Word(term='a-other-language', language='es', knowledge_level=1,
             translation_items=[WordTranslation(position=0, value='answer', language='en')]),
    ])
    db.commit()
    assert stats_router.get_revisit_practice(db, 'weak', 1) == []
    configure_language(db, 'en', 'en')
    practice = stats_router.get_revisit_practice(db, 'weak', 1)
    assert [word.term for word in practice] == [f'practice-{i:02}' for i in range(10)]
    assert practice[0].translation_groups == {'en': ['answer-0']}


def test_learning_stats_summarizes_usage_and_reviews_without_loading_orm_events(db):
    word = Word(term='one')
    db.add(word)
    db.flush()
    now = datetime.now(UTC).replace(hour=12)
    yesterday = now - timedelta(days=1)
    db.add_all([
        AppUsageEvent(event_key='test-use-1', session_key='day-spanning', active_seconds=30, created_at=yesterday),
        AppUsageEvent(event_key='test-use-2', session_key='day-spanning', active_seconds=45, created_at=now),
        AppUsageEvent(event_key='test-use-3', session_key='first', active_seconds=15, created_at=now),
        AppUsageEvent(event_key='test-use-4', session_key='first', active_seconds=600, created_at=now, language='es'),
        WordProgressEvent(word_id=word.id, old_level=1, new_level=3, source='study_list', created_at=yesterday),
        WordProgressEvent(word_id=word.id, old_level=3, new_level=3, source='study_list', created_at=now),
    ])
    db.commit()
    loaded = []

    @event.listens_for(db, 'loaded_as_persistent')
    def track_event_loads(_db, instance):
        if isinstance(instance, (AppUsageEvent, WordProgressEvent)):
            loaded.append(instance)

    stats = stats_router.get_learning_stats(db)
    assert stats.usage_summary.model_dump() == {
        'total_active_seconds': 90, 'active_days': 2, 'sessions': 2, 'avg_session_seconds': 45,
        'longest_session_seconds': 75, 'today_active_seconds': 60, 'last_7d_active_seconds': 90,
    }
    assert [(day.date, day.active_seconds) for day in stats.usage_daily] == [
        (now.date().isoformat(), 60), (yesterday.date().isoformat(), 30),
    ]
    assert stats.review_periods['all'].attempts == 2
    assert stats.review_periods['all'].unique_words == 1
    assert not loaded


def test_split_stats_keep_current_knowledge_and_review_history_in_learning(db, monkeypatch):
    topic = Topic(name='Travel', slug='travel')
    child = Topic(name='Rail', slug='rail', parent_topic=topic)
    reviewed = Word(term='train', knowledge_level=3, topics=[topic, child])
    archived = Word(term='ferry', knowledge_level=4, deleted_at=datetime.now(UTC))
    db.add_all([reviewed, archived, Word(term='ticket', knowledge_level=1),
                Word(term='platform', knowledge_level=5), Word(term='track', knowledge_level=null())])
    db.flush()
    db.add_all([WordProgressEvent(word_id=reviewed.id, old_level=1, new_level=3, source='study_list'),
                WordProgressEvent(word_id=archived.id, old_level=4, new_level=1, source='study_list')])
    db.commit()

    library = stats_router.get_library_stats(db)
    assert library.overview.total_words == 4
    assert library.study_coverage.reviewed_words == 1
    assert library.study_coverage.reviewed_word_share_pct == 25
    assert {t.slug: t.total for t in library.topics} == {'travel': 1, 'rail': 1}
    assert 'level_counts' not in library.model_dump()

    def reject_library_scan(_db):
        pytest.fail('Learning statistics loaded full library content')

    monkeypatch.setattr(stats_service, 'list_active_word_stats', reject_library_scan)
    learning = stats_router.get_learning_stats(db)
    assert learning.level_counts.model_dump() == {
        'level_1': 1, 'level_2': 0, 'level_3': 1, 'level_4': 0, 'level_5': 1, 'unset': 1,
    }
    assert learning.okay_or_better_pct == 50
    assert learning.review_history.reviewed_words == 2
    assert learning.review_history.improved_words == 1
    assert learning.review_history.regressed_words == 1
    assert {t.slug: t.reviewed_count for t in learning.topics} == {'travel': 1, 'rail': 1}
    assert 'overview' not in learning.model_dump()


def test_library_import_changes_coverage_without_creating_review_activity(db, monkeypatch):
    reviewed = Word(term='one', knowledge_level=4)
    db.add(reviewed)
    db.flush()
    db.add(WordProgressEvent(word_id=reviewed.id, old_level=3, new_level=4, source='study_list'))
    db.commit()
    before = stats_router.get_learning_stats(db)
    db.add_all([Word(term='two', source='import'), Word(term='uno', language='es', source='import')])
    db.commit()
    after = stats_router.get_learning_stats(db)
    assert after.review_history == before.review_history
    assert after.daily_activity == before.daily_activity
    assert after.level_counts.level_1 == before.level_counts.level_1 + 1

    def reject_usage_scan(_db):
        pytest.fail('Library statistics loaded usage history')

    monkeypatch.setattr(stats_service, '_build_usage_stats', reject_usage_scan)
    library = stats_router.get_library_stats(db)
    assert library.overview.total_words == 2
    assert sum(library.words_added_by_month.values()) == 2
    assert library.study_coverage.never_reviewed_words == 1
    assert library.study_coverage.reviewed_word_share_pct == 50
    configure_language(db, 'es')
    assert stats_router.get_library_stats(db).overview.total_words == 1
    assert stats_router.get_library_stats(db).study_coverage.reviewed_words == 0


def test_stats_after_generating_daily_mix_in_sqlite(db):
    db.add(StudyQueue(total_count=1, completed_count=0,
                      expires_at=datetime.now(UTC) + timedelta(hours=24)))
    db.commit()
    db.expunge_all()
    assert compute_stats(db).queue_summary.active_queues == 1
    assert stats_router.get_learning_stats(db).mix_activity.started == 0


def test_study_reports_count_distinct_words_and_real_study_actions(db):
    now = datetime.now(UTC)
    practiced = Word(term='practiced', knowledge_level=1)
    imported = Word(term='imported', knowledge_level=4)
    db.add_all([practiced, imported])
    db.flush()
    for word, old, new, days_ago, source in [
        (practiced, 1, 3, 15, 'study_list'),
        (practiced, 3, 1, 4, 'study_list'),
        (practiced, 1, 4, 3, 'manual'),
        (practiced, 4, 1, 2, 'smart_review'),
        (practiced, 1, 1, 1, 'study_list'),
        (imported, 1, 4, 2, 'xlsx_import'),
    ]:
        db.add(WordProgressEvent(
            word_id=word.id, old_level=old, new_level=new, created_at=now - timedelta(days=days_ago), source=source,
        ))
    db.commit()
    stats = stats_router.get_learning_stats(db)
    assert stats.review_periods['7'].model_dump() == {
        'attempts': 3, 'unique_words': 1, 'first_reviews': 0, 'repeat_reviews': 3,
        'improved_words': 0, 'regressed_words': 1, 'study_days': 3,
    }
    assert stats.review_periods['all'].first_reviews == 1
    assert stats.consistency_summary.study_streak_days == 2
    assert stats.review_history.reviewed_words == 1
    assert stats.level_counts.level_4 == 1
    assert stats_router.get_library_stats(db).study_coverage.reviewed_words == 1
    assert [row.term for row in stats_router.get_revisit_entries(db, 'unreviewed').entries] == ['imported']
    assert [row.term for row in stats_router.get_revisit_entries(db, 'downgraded').entries] == ['practiced']
    assert compute_stats(db).retention_summary.reviewed_words == 2


def test_learning_history_treats_retired_basic_rating_as_okay(db):
    word = Word(term='one', knowledge_level=3)
    db.add(word)
    db.flush()
    db.add(WordProgressEvent(word_id=word.id, old_level=2, new_level=3, source='study_list'))
    db.commit()
    stats = stats_router.get_learning_stats(db)
    assert stats.review_periods['all'].unique_words == 1
    assert stats.review_periods['all'].improved_words == 0
    assert stats.review_history.improved_words == 0
    assert stats.daily_activity[0].net == 0


def test_library_readiness_matches_selected_language_and_gap_lists(db):
    first = Topic(name='First', slug='first')
    second = Topic(name='Second', slug='second', parent_topic=first)
    one = Word(term='one', topics=[first, second], translation_items=[WordTranslation(position=0, value='один')],
               example_items=[WordExample(position=0, value='One word.')])
    two = Word(term='two', translation_items=[WordTranslation(position=0, value='two', language='en')])
    archived = Word(term='archived', deleted_at=datetime.now(UTC))
    db.add_all([one, two, archived, Word(term='uno', language='es')])
    db.commit()
    ru = stats_router.get_library_stats(db)
    assert ru.readiness.model_dump() == {
        'translation_language': 'ru', 'ready': 1, 'missing_translation': 1, 'no_examples': 1,
        'needs_examples': 2, 'no_topic': 1, 'multiple_topics': 1,
    }
    for gap, terms in [('translation', ['two']), ('no-examples', ['two']), ('needs-examples', ['one', 'two']),
                       ('no-topic', ['two']), ('multiple-topics', ['one'])]:
        result = stats_router.get_library_entries(db, gap)
        assert result.total == len(terms)
        assert [row.term for row in result.entries] == terms
        assert not result.has_more
    configure_language(db, 'en', 'en')
    assert stats_router.get_library_stats(db).readiness.ready == 0
    assert [row.term for row in stats_router.get_library_entries(db, 'translation').entries] == ['one']


def test_daily_mix_counts_activity_from_first_to_last_recorded_item(db):
    now = datetime.now(UTC)
    word = Word(term='one')
    db.add(word)
    done, live, expired, empty = [
        StudyQueue(total_count=total, completed_count=count, expires_at=now + timedelta(days=expires))
        for total, count, expires in [(2, 2, 1), (4, 1, 1), (3, 1, -1), (0, 0, 1)]
    ]
    db.add_all([done, live, expired, empty])
    db.flush()
    db.add_all([
        StudyQueueItem(queue_id=done.id, word_id=word.id, position=i, is_completed=True,
                       completed_at=now - timedelta(seconds=seconds))
        for i, seconds in enumerate([150, 30])
    ])
    db.commit()
    assert stats_router.get_learning_stats(db).mix_activity.model_dump() == {
        'started': 3, 'completed': 1, 'in_progress': 1, 'unfinished': 1,
        'completion_rate_pct': 50, 'avg_completion_span_seconds': 120,
    }


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
