from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.preferences.model import AppPreferences
from app.features.smart_review import service
from app.features.smart_review.model import StudyQueue
from app.features.topics.model import Topic
from app.features.words.model import Word


@pytest.mark.parametrize('parallel_requests', [1, 2])
def test_first_daily_mix_reads_share_a_single_active_queue(concurrency_engine, monkeypatch, parallel_requests):
    engine = concurrency_engine
    with Session(engine) as db:
        db.add(Word(term='hello', knowledge_level=1, topics=[Topic(name='Inbox', slug='inbox')]))
        db.add(AppPreferences(id=1, values={'word_mix': {'size': 1, 'levels': [1], 'cooldown_days': 0}}))
        db.commit()
    barrier = Barrier(parallel_requests)
    monkeypatch.setattr(service.settings, 'smart_review_enabled', True)

    def request_queue(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            return service.get_or_create_active_queue(db).id

    try:
        with ThreadPoolExecutor(max_workers=parallel_requests) as pool:
            returned_ids = list(pool.map(request_queue, range(parallel_requests)))
        with Session(engine) as db:
            active = db.scalars(select(StudyQueue).where(StudyQueue.is_active.is_(True))).all()
            assert len(set(returned_ids)) == 1
            assert len(active) == 1, f'Active queues: {[q.id for q in active]}; returned: {returned_ids}'
    finally:
        engine.dispose()
