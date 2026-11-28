from uuid import uuid4

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.features.offline.model import OfflineReceipt
from app.features.offline.router import OfflineChangeBatch, sync_change_batch
from app.features.offline.service import OfflineChange, word_data
from app.features.topics.model import Topic
from app.features.words.model import Word
from app.shared.db import Base


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        topic = Topic(name="Nature", slug="nature")
        session.add_all([
            Word(term="meadow", knowledge_level=1, topics=[topic]),
            Word(term="woodland", knowledge_level=1, topics=[topic]),
        ])
        session.commit()
        yield session
    engine.dispose()


def test_independent_uploads_commit_and_retry_even_if_another_edit_is_rejected(db):
    words = db.scalars(select(Word).order_by(Word.id)).all()
    absent = OfflineChange(id=uuid4(), entity="word", action="update", entity_id=100,
                           before=word_data(words[0]), data={"knowledge_level": 4})
    valid = OfflineChange(id=uuid4(), entity="word", action="update", entity_id=words[1].id,
                          before=word_data(words[1]), data={"knowledge_level": 4})
    payload = OfflineChangeBatch(changes=[absent, valid])
    result = sync_change_batch(payload, db)
    assert [(item["change_id"], item["status"]) for item in result["results"]] == [
        (str(absent.id), 409), (str(valid.id), 200),
    ]
    assert result["results"][1]["result"]["entity_id"] == words[1].id
    assert sync_change_batch(payload, db) == result
    assert db.get(Word, words[1].id).knowledge_level == 4
    assert db.scalar(select(func.count()).select_from(OfflineReceipt)) == 1
