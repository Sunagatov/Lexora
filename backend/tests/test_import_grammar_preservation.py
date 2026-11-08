from io import BytesIO

import pytest
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.words.model import PartsOfSpeech, Word, WordTranslation, WordVerbForm
from app.features.words.workbook.flat import build_flat_workbook
from app.features.words.workbook.import_batches import apply_import, preview_import
from app.features.words.workbook.import_source import read_import_source
from app.shared.db import Base


@pytest.mark.parametrize('new_pos', ['verb', 'noun'])
def test_import_changes_pos_and_preserves_noncontent_verb_metadata(new_pos):
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            verb, noun = PartsOfSpeech(name='verb'), PartsOfSpeech(name='noun')
            word = Word(term='run', topics=[Topic(name='Inbox', slug='inbox')], part_of_speech=verb,
                verb_form=WordVerbForm(past_simple='ran', past_participle='run'),
                translation_items=[WordTranslation(position=0, value='бежать')])
            db.add_all([word, noun])
            db.commit()
            book = load_workbook(BytesIO(build_flat_workbook(db)))
            headers = {cell.value: cell.column for cell in book['Words'][1]}
            book['Words'].cell(2, headers['Part of speech'], new_pos)
            content = BytesIO()
            book.save(content)
            plan = preview_import(db, read_import_source(content.getvalue()), mode='content', minimum_translations=0)
            assert not plan['errors'], plan['errors']
            apply_import(db, plan['batch_id'], plan['plan_hash'])
            db.refresh(word)
            assert word.part_of_speech.name == new_pos
            assert word.verb_form.past_simple == 'ran'
    finally:
        engine.dispose()
