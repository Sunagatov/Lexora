from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.smart_review import model as review_model  # noqa: F401 - register relationships
from app.features.topics.model import Topic
from app.features.words.ai_curation.common import AiCurationImportError
from app.features.words.ai_curation.import_service import import_ai_curation
from app.features.words.ai_curation.schemas import AiCurationImportRequest
from app.features.words.model import Word
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


@pytest.mark.parametrize('update_content', [False, True])
def test_curation_update_and_reassign_do_not_mark_their_own_write_stale(db, update_content):
    source = Topic(name='Source', slug='source')
    target = Topic(name='Target', slug='target')
    word = Word(term='hello', topics=[source], definition='old definition',
                updated_at=datetime(2020, 1, 1))
    db.add_all([word, target])
    db.commit()
    payload = AiCurationImportRequest(
        source_topic_id=source.id, exported_at=datetime(2021, 1, 1),
        word_updates=[{'id': word.id, 'definition': 'new definition'}] if update_content else [],
        word_reassigns=[{'id': word.id, 'add_topic_refs': [{'topic_id': target.id}],
                         'remove_topic_ids': [source.id]}],
    )
    result = import_ai_curation(db, payload)
    assert result.reassigned_words == 1
    assert {topic.id for topic in word.topics} == {target.id}


@pytest.mark.parametrize('changed_field', ['definition', 'example_entries'])
def test_curation_detects_intervening_editor_changes(db, changed_field):
    source = Topic(name='Source', slug='source')
    word = Word(term='hello', topics=[source], definition='original',
                updated_at=datetime(2020, 1, 1))
    db.add(word)
    db.commit()
    exported_at = datetime(2021, 1, 1)
    patch = {'definition': 'new manual definition'} if changed_field == 'definition' else {
        'example_entries': ['A new example written manually after export.']}
    update_word(db, word, WordUpdate(**patch))
    payload = AiCurationImportRequest(source_topic_id=source.id, exported_at=exported_at,
        word_updates=[{'id': word.id, 'example_entries': ['An older AI example from the export.']}])
    with pytest.raises(AiCurationImportError, match='modified after export'):
        import_ai_curation(db, payload)
