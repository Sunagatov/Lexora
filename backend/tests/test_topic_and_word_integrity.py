from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.features.topics import service as topic_service
from app.features.topics.exceptions import InvalidTopicParentError, TopicNameConflictError
from app.features.topics.model import Topic
from app.features.topics.schemas import TopicCreate, TopicUpdate
from app.features.words.model import Word
from app.features.words.router import router as words_router
from app.features.words.workbook.import_plan import build_import_plan
from app.shared.db import Base
from app.shared.deps import get_db


@pytest.mark.parametrize('parallel_moves', [1, 2])
def test_concurrent_topic_moves_preserve_acyclic_hierarchy(concurrency_engine, parallel_moves):
    engine = concurrency_engine
    with Session(engine) as db:
        db.add_all([Topic(id=1, name='Travel', slug='travel'), Topic(id=2, name='Work', slug='work')])
        db.commit()
    barrier = Barrier(parallel_moves)
    def move(topic_id):
        with Session(engine) as db:
            topic = db.get(Topic, topic_id)
            barrier.wait(timeout=10)
            try:
                topic_service.update_topic(db, topic, TopicUpdate(parent_topic_id=3-topic_id))
                return True
            except InvalidTopicParentError:
                db.rollback()
                return False

    try:
        with ThreadPoolExecutor(max_workers=parallel_moves) as pool:
            accepted = list(pool.map(move, range(1, parallel_moves+1)))
            assert sum(accepted) == 1
        with Session(engine) as db:
            parents = {topic.id: topic.parent_topic_id for topic in db.scalars(select(Topic)).all()}
        for start in parents:
            seen = set()
            current = start
            while current is not None:
                assert current not in seen, f'Cycle persisted: {parents}'
                seen.add(current)
                current = parents[current]
    finally:
        engine.dispose()


@pytest.mark.parametrize('names', [('Travel', 'TRAVEL'), ('Straße', 'STRASSE')])
def test_case_equivalent_topic_names_remain_unambiguous_for_import(tmp_path, names):
    engine = create_engine(f'sqlite:///{tmp_path / "names.sqlite"}')
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            topic_service.create_topic(db, TopicCreate(name=names[0]))
            try:
                topic_service.create_topic(db, TopicCreate(name=names[1]))
            except TopicNameConflictError:
                db.rollback()
            source = {'sha256': '0'*64, 'errors': [], 'warnings': [], 'topics': [],
                'rows': [{'word_id': None, 'term': 'hello', 'fields': {'translations': ['привет']},
                          'topic_refs': ['name:'+names[0]], 'sheet': 'Words', 'row': 2}]}
            plan = build_import_plan(db, source, mode='add', minimum_translations=0)
            assert not plan['errors'], plan['errors']
    finally:
        engine.dispose()


@pytest.mark.parametrize('patch, expected_status', [
    ({'cefr_level': 'A1'}, 200),
    ({'cefr_level': 'Z9'}, 422),
    ({'register': 'casual'}, 422),
    ({'countability': 'sometimes'}, 422),
    ({'language': None}, 422),
])
def test_invalid_word_fields_return_validation_errors_instead_of_server_errors(patch, expected_status):
    engine = create_engine('sqlite+pysqlite:///:memory:', poolclass=StaticPool,
                           connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Word(id=1, term='hello', topics=[Topic(name='Inbox', slug='inbox')]))
        db.commit()

    def scoped_db():
        with Session(engine) as db:
            yield db

    app = FastAPI()
    app.dependency_overrides[get_db] = scoped_db
    app.include_router(words_router)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.put('/api/words/1', json=patch)
        assert response.status_code == expected_status, (patch, response.status_code, response.text)
    finally:
        engine.dispose()


@pytest.mark.parametrize('field,value', [('cefr_level', 'Z9'), ('register', 'casual'), ('countability', 'sometimes')])
def test_word_input_paths_reject_invalid_enums(field, value):
    from pydantic import ValidationError

    from app.features.words.ai_curation.schemas import WordUpdateV2
    from app.features.words.ai_review.schemas import AiReviewImportWord
    from app.features.words.schemas import WordCreate, WordInput

    for schema, required in [
        (WordCreate, {'term': 'hello', 'topic_ids': [1]}),
        (WordInput, {'term': 'hello'}),
        (WordUpdateV2, {'id': 1}),
        (AiReviewImportWord, {'id': 1, 'term': 'hello'}),
    ]:
        with pytest.raises(ValidationError):
            schema.model_validate({**required, field: value})
