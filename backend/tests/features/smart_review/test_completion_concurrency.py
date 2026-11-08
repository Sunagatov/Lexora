"""Completion must tolerate stale sessions and duplicate concurrent requests."""

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

from app.features.smart_review.lifecycle import complete_queue_item
from app.features.smart_review.model import StudyQueue, StudyQueueItem
from app.features.topics.model import Topic  # noqa: F401 - register referenced tables
from app.features.words.model import Word
from app.shared.db import Base


def seed_queue(engine, size):
    with Session(engine) as db:
        words = [Word(term=f"review-{i}", language="en", knowledge_level=1,
                      is_active=True, source="manual") for i in range(size)]
        queue = StudyQueue(language="en", expires_at=datetime.now(UTC) + timedelta(days=1),
                           total_count=size, completed_count=0, is_active=True)
        db.add_all([queue, *words])
        db.flush()
        items = [StudyQueueItem(queue_id=queue.id, word_id=word.id, position=i,
                                is_completed=False) for i, word in enumerate(words)]
        db.add_all(items)
        db.commit()
        return queue.id, [item.id for item in items]


@pytest.mark.parametrize("second_item", [0, 1])
def test_stale_sessions_count_distinct_completions_and_ignore_retries(tmp_path, second_item):
    engine = create_engine(f"sqlite:///{tmp_path / 'review.sqlite'}")
    try:
        Base.metadata.create_all(engine)
        queue_id, items = seed_queue(engine, 2)
        with Session(engine, expire_on_commit=False) as first, Session(engine, expire_on_commit=False) as second:
            # Hold the ORM objects to reproduce two requests' overlapping reads.
            stale_queue = second.get(StudyQueue, queue_id)
            stale_item = second.get(StudyQueueItem, items[second_item])
            assert stale_queue.completed_count == 0 and not stale_item.is_completed
            complete_queue_item(first, items[0])
            result = complete_queue_item(second, items[second_item])
            assert result.completed_count == (1 if second_item == 0 else 2)
        with Session(engine) as db:
            completed = db.scalar(select(func.count()).select_from(StudyQueueItem)
                                  .where(StudyQueueItem.is_completed.is_(True)))
            assert db.get(StudyQueue, queue_id).completed_count == completed
    finally:
        engine.dispose()


def test_postgres_concurrent_completions_are_atomic_and_idempotent():
    port = os.environ.get("LEXORA_REVIEW_TEST_POSTGRES_PORT")
    if not port:
        pytest.skip("Disposable PostgreSQL port not supplied")
    assert port.isdecimal() and 1024 <= int(port) <= 65535
    root = create_engine(
        f"postgresql+psycopg://lexora_review_test:local-test-only@127.0.0.1:{port}/lexora_review_test"
    )
    schema = "review_" + uuid4().hex
    engine = root.execution_options(schema_translate_map={None: schema})
    try:
        with root.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        Base.metadata.create_all(engine)
        queue_id, items = seed_queue(engine, 4)
        barrier = Barrier(8)

        def complete(item_id):
            with Session(engine, expire_on_commit=False) as db:
                stale_item = db.get(StudyQueueItem, item_id)
                stale_queue = db.get(StudyQueue, queue_id)
                assert not stale_item.is_completed and stale_queue.completed_count == 0
                barrier.wait(timeout=15)
                complete_queue_item(db, item_id)

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(complete, items * 2))
        with Session(engine) as db:
            assert db.get(StudyQueue, queue_id).completed_count == 4
            assert db.scalar(select(func.count()).select_from(StudyQueueItem)
                             .where(StudyQueueItem.is_completed.is_(True))) == 4
    finally:
        with root.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        root.dispose()
