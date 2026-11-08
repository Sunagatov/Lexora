from io import BytesIO

import pytest
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.trash.service import restore_word_from_trash
from app.features.words.model import PartsOfSpeech, Word, WordTranslation
from app.features.words.repository import create_word, soft_delete_word
from app.features.words.schemas import WordCreate
from app.features.words.workbook.flat import build_flat_workbook
from app.features.words.workbook.import_batches import apply_import, preview_import
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


@pytest.mark.parametrize('unclassified', [True, False])
def test_restore_legal_same_spelling_different_pos(db, unclassified):
    topic = Topic(name='Inbox', slug='inbox')
    db.add_all([topic, PartsOfSpeech(name='noun'), PartsOfSpeech(name='verb')])
    db.commit()
    first = create_word(db, WordCreate(topic_ids=[topic.id], term='run',
                                     part_of_speech=None if unclassified else 'verb'))
    create_word(db, WordCreate(topic_ids=[topic.id], term='run', part_of_speech='noun'))
    soft_delete_word(db, first)
    restored = restore_word_from_trash(db, first.id)
    assert restored.deleted_at is None


@pytest.mark.parametrize('translation_language', ['ru', 'en'])
def test_export_edit_and_reimport_existing_word_without_selected_translation(db, translation_language):
    topic = Topic(name='Inbox', slug='inbox')
    word = Word(term='run', topics=[topic], translation_items=[
        WordTranslation(position=0, language='ru', value='бежать')])
    db.add(word)
    db.commit()
    db.info['translation_language'] = translation_language
    book = load_workbook(BytesIO(build_flat_workbook(db)))
    headers = {cell.value: cell.column for cell in book['Words'][1]}
    notes_header = next(name for name in headers if 'note' in name.lower())
    book['Words'].cell(2, headers[notes_header], 'Edited notes')
    content = BytesIO()
    book.save(content)
    source = read_import_source(content.getvalue())
    preview = preview_import(db, source, mode='content', minimum_translations=0)
    assert not preview['errors'], preview['errors']
    result = apply_import(db, preview['batch_id'], preview['plan_hash'])
    assert result['updated'] == 1


@pytest.mark.parametrize('layout', ['flat', 'topics'])
def test_export_keeps_equal_sign_vocabulary_as_literal_text(db, layout):
    topic = Topic(name='Math', slug='math')
    word = Word(term='=SUM(1,2)', topics=[topic], translation_items=[
        WordTranslation(position=0, language='ru', value='сумма')])
    db.add(word)
    db.commit()
    content = build_flat_workbook(db) if layout == 'flat' else build_words_workbook(db)[1]
    book = load_workbook(BytesIO(content))
    sheet = book['Words' if layout == 'flat' else 'Math']
    assert sheet.cell(2, 2).value == '=SUM(1,2)'
    assert sheet.cell(2, 2).data_type == 's', 'Vocabulary content must never become an Excel formula'
    source = read_import_source(content)
    assert not source['errors'], source['errors']
