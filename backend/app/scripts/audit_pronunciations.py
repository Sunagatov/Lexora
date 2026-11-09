"""Print aggregate pronunciation coverage; never populate or modify vocabulary."""
import json


def main():
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from app.features.topics.model import Topic  # noqa: F401 — register relationships
    from app.features.words.pronunciation_audit import pronunciation_coverage
    from app.shared.db import engine

    if engine.dialect.name != "postgresql":
        raise SystemExit("PostgreSQL required; refusing to report SQLite fallback as live data")
    with engine.connect() as connection, Session(bind=connection) as db, db.begin():
        db.execute(text("SET TRANSACTION READ ONLY"))
        db.execute(text("SET LOCAL statement_timeout = '15s'"))
        print(json.dumps({
            "scope": "non-deleted words, all libraries",
            "libraries": pronunciation_coverage(db),
        }, indent=2))


if __name__ == "__main__":
    main()
