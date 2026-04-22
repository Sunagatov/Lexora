from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.features.topics.model  # noqa: F401 - registers Topic in SQLAlchemy metadata
import app.features.words.model  # noqa: F401 - registers Word in SQLAlchemy metadata

from app.features.topics import service as topic_service
from app.features.topics.model import Topic
from app.features.words.model import Word
from app.shared.db import Base


def _make_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_compute_topic_sidebar_stats_aggregates_by_topic_tree() -> None:
    db = _make_session()

    parent = Topic(name="Parent", slug="parent", is_active=True)
    child = Topic(name="Child", slug="child", parent_topic=parent, is_active=True)
    sibling = Topic(name="Sibling", slug="sibling", parent_topic=parent, is_active=True)
    db.add_all([parent, child, sibling])
    db.flush()

    db.add_all([
        Word(term="alpha", translations="alpha", knowledge_level=4, topics=[child]),
        Word(term="beta", translations="beta", knowledge_level=2, topics=[sibling]),
        Word(term="gamma", translations="gamma", knowledge_level=1, topics=[child, sibling]),
    ])
    db.commit()

    result = topic_service.compute_topic_sidebar_stats(db)

    assert result.total_words == 3
    assert result.topic_counts[parent.id] == 3
    assert result.topic_counts[child.id] == 2
    assert result.topic_counts[sibling.id] == 2
    assert result.topic_progress[parent.id] == 44
    assert result.topic_progress[child.id] == 50
    assert result.topic_progress[sibling.id] == 17
