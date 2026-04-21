from pathlib import Path


def test_initial_migration_contains_current_schema_surface() -> None:
    text = Path("backend/alembic/versions/20260406_0001_initial_tables.py").read_text(encoding="utf-8")

    required_tokens = [
        'op.create_table(\n        "topics"',
        'op.create_table(\n        "words"',
        'op.create_table(\n        "word_topics"',
        'op.create_table(\n        "word_translations"',
        'op.create_table(\n        "word_examples"',
        'op.create_table(\n        "study_queues"',
        'op.create_table(\n        "study_queue_items"',
        'op.create_table(\n        "word_progress_events"',
        '"deleted_at"',
        '"deleted_via_topic_id"',
    ]

    for token in required_tokens:
        assert token in text
