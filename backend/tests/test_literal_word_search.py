import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.repository import get_all_words
from app.shared.db import Base


@pytest.mark.parametrize('search, expected', [('hello', ['hello']), ('%', ['10%']), ('one_two', ['one_two'])])
def test_search_treats_user_input_as_literal_text(search, expected):
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            topic = Topic(name='Inbox', slug='inbox')
            db.add_all(Word(term=term, topics=[topic]) for term in ['hello', '10%', '10x', 'one_two', 'oneXtwo'])
            db.commit()
            result = get_all_words(db, search=search)
            assert sorted(word.term for word in result) == sorted(expected)
    finally:
        engine.dispose()
