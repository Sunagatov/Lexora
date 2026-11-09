from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.words.ai_curation import service as curation
from app.features.words.ai_curation.schemas import AiCurationImportRequest
from app.features.words.model import Word, WordTranslation
from app.features.words.workbook.import_plan import build_import_plan
from app.features.words.workbook.import_source import read_import_source
from app.features.words.workbook.service import build_words_workbook
from app.shared.db import Base


@pytest.fixture
def db():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.mark.parametrize('topic_name', ['Inbox', 'Lists', 'lists', '__lexora_meta', '_Lexora_Language'])
def test_topic_export_reimports_into_its_original_topic(db, topic_name):
    topic = Topic(name=topic_name, slug=topic_name.lower())
    word = Word(term='hello', topics=[topic], translation_items=[WordTranslation(position=0, value='привет')])
    db.add(word)
    db.commit()
    exported = build_words_workbook(db)[1]
    plan = build_import_plan(db, read_import_source(exported), mode='content', minimum_translations=0)
    assert not plan['errors'], plan['errors']
    assert plan['entries'][0]['after']['topic_ids'] == [str(topic.id)]


@pytest.mark.parametrize('use_exported_timestamp', [False, True])
def test_curation_roundtrip_with_exported_timestamp_in_sqlite(db, use_exported_timestamp):
    topic = Topic(name='Inbox', slug='inbox')
    word = Word(term='hello', topics=[topic], updated_at=datetime(2020, 1, 1))
    db.add(word)
    db.commit()
    db.expunge_all()
    topic_id = 1
    exported = curation.export_topic_words_lean_page(db, topic_id, page=1, page_size=10)
    payload = {'source_topic_id': topic_id, 'word_updates': [{'id': exported.words[0].id,
               'example_entries': ['Hello, everyone!']}]}
    if use_exported_timestamp:
        payload['exported_at'] = exported.model_dump(mode='json')['exported_at']
    result = curation.import_ai_curation(db, AiCurationImportRequest.model_validate(payload))
    assert result.updated_words == 1


@pytest.mark.parametrize('updated_aware', [False, True])
@pytest.mark.parametrize('export_aware', [False, True])
@pytest.mark.parametrize('stale', [False, True])
def test_ai_import_staleness_uses_utc_for_both_formats(updated_aware, export_aware, stale):
    from datetime import UTC, timedelta
    from types import SimpleNamespace

    from app.features.words.ai_curation.common import AiCurationImportError
    from app.features.words.ai_curation.import_support import _check_stale
    from app.features.words.ai_review.import_support import assert_not_stale

    exported = datetime(2026, 11, 1, 12)
    updated = exported + timedelta(seconds=1 if stale else -1)
    if updated_aware:
        updated = updated.replace(tzinfo=UTC)
    if export_aware:
        exported = exported.replace(tzinfo=UTC)
    word = SimpleNamespace(id=1, term='hello', updated_at=updated)
    payload = SimpleNamespace(exported_at=exported, words=[SimpleNamespace(id=1)])
    if stale:
        with pytest.raises(AiCurationImportError, match='modified after export'):
            _check_stale(word, exported, 'update_existing_word')
        with pytest.raises(ValueError, match='modified after export'):
            assert_not_stale(payload, {1: word}, ValueError)
    else:
        _check_stale(word, exported, 'update_existing_word')
        assert_not_stale(payload, {1: word}, ValueError)
