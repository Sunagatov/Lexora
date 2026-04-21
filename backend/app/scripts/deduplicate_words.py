"""
One-time deduplication script.

What it does
------------
1. Finds all words that share the same normalised term (case-insensitive, trimmed).
2. For each duplicate group picks ONE canonical row:
   - active words preferred over soft-deleted ones
   - highest knowledge_level wins within that tier
   - lowest id breaks ties (deterministic)
3. Collects every topic_id the group appeared in (via word_topics) and inserts
   missing rows so the canonical word belongs to all those topics.
4. Re-points study_queue_items that reference a duplicate word_id to the canonical
   word_id, skipping rows where the canonical is already in the same queue
   (avoids logical duplicates inside one review session).
5. Hard-deletes the duplicate rows from `words` (cascade removes their word_topics rows).

Run in dry-run mode first (default) to preview changes, then pass --apply to commit.

Usage
-----
    # from the backend/ directory (with .env present or env vars set):
    python -m app.scripts.deduplicate_words            # dry-run
    python -m app.scripts.deduplicate_words --apply    # commit changes
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from typing import TypedDict

from sqlalchemy import text

from app.shared.db import SessionLocal


class WordRow(TypedDict):
    id: int
    term: str
    knowledge_level: int
    is_active: bool
    topic_ids: list[int]


def _normalize(term: str) -> str:
    return term.strip().lower()


def _check_word_topics_exists(db) -> bool:
    return db.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'word_topics')"
        )
    ).scalar()


def _load_words(db) -> list[WordRow]:
    """Load all words with their topic_ids from word_topics (post-migration schema)."""
    rows = db.execute(
        text(
            "SELECT w.id, w.term, w.knowledge_level, w.deleted_at, "
            "COALESCE(array_agg(wt.topic_id) FILTER (WHERE wt.topic_id IS NOT NULL), '{}') AS topic_ids "
            "FROM words w "
            "LEFT JOIN word_topics wt ON wt.word_id = w.id "
            "GROUP BY w.id "
            "ORDER BY w.id"
        )
    ).fetchall()
    return [
        {
            "id": r.id,
            "term": r.term,
            "knowledge_level": r.knowledge_level or 0,
            "is_active": r.deleted_at is None,
            "topic_ids": list(r.topic_ids or []),
        }
        for r in rows
    ]


def _pick_canonical(members: list[WordRow]) -> WordRow:
    """Active words first, then highest knowledge_level, then lowest id."""
    return max(members, key=lambda w: (w["is_active"], w["knowledge_level"], -w["id"]))


def _merge_group(db, canonical: WordRow, dup_ids: list[int], all_topic_ids: list[int]) -> None:
    # 1. Link canonical to all topics from the group
    existing = {
        r[0]
        for r in db.execute(
            text("SELECT topic_id FROM word_topics WHERE word_id = :wid"),
            {"wid": canonical["id"]},
        ).fetchall()
    }
    for tid in all_topic_ids:
        if tid not in existing:
            db.execute(
                text("INSERT INTO word_topics (word_id, topic_id) VALUES (:wid, :tid)"),
                {"wid": canonical["id"], "tid": tid},
            )

    # 2. Re-point study_queue_items; skip if canonical already in that queue
    for dup_id in dup_ids:
        dup_items = db.execute(
            text("SELECT id, queue_id FROM study_queue_items WHERE word_id = :did"),
            {"did": dup_id},
        ).fetchall()
        for item in dup_items:
            already_in_queue = db.execute(
                text(
                    "SELECT 1 FROM study_queue_items "
                    "WHERE queue_id = :qid AND word_id = :cid"
                ),
                {"qid": item.queue_id, "cid": canonical["id"]},
            ).scalar()
            if already_in_queue:
                db.execute(
                    text("DELETE FROM study_queue_items WHERE id = :iid"),
                    {"iid": item.id},
                )
            else:
                db.execute(
                    text("UPDATE study_queue_items SET word_id = :cid WHERE id = :iid"),
                    {"cid": canonical["id"], "iid": item.id},
                )

    # 3. Hard-delete duplicates (cascades word_topics rows for those ids)
    db.execute(
        text("DELETE FROM words WHERE id = ANY(:ids)"),
        {"ids": dup_ids},
    )


def run(apply: bool) -> None:
    with SessionLocal() as db:
        if not _check_word_topics_exists(db):
            print(
                "ERROR: 'word_topics' table does not exist yet.\n"
                "Run the Alembic migration first:\n"
                "  alembic upgrade 20260406_0005\n"
                "Then re-run this script."
            )
            return

        words = _load_words(db)

        groups: dict[str, list[WordRow]] = defaultdict(list)
        for w in words:
            groups[_normalize(w["term"])].append(w)

        duplicates = {term: members for term, members in groups.items() if len(members) > 1}
        print(f"Found {len(duplicates)} duplicate term(s).\n")

        if not duplicates:
            print("Nothing to do.")
            return

        total_merged = 0

        for norm_term, members in duplicates.items():
            canonical = _pick_canonical(members)
            dup_ids = [w["id"] for w in members if w["id"] != canonical["id"]]
            all_topic_ids = list({tid for w in members for tid in w["topic_ids"]})

            print(
                f"  term='{canonical['term']}' | canonical id={canonical['id']} "
                f"(level={canonical['knowledge_level']}, active={canonical['is_active']}) | "
                f"merging ids={dup_ids} | all topics={all_topic_ids}"
            )

            if apply:
                _merge_group(db, canonical, dup_ids, all_topic_ids)

            total_merged += len(dup_ids)

        print(f"\n{'[DRY RUN] Would merge' if not apply else 'Merged'} {total_merged} duplicate word row(s).")

        if apply:
            db.commit()
            print("Changes committed.")
        else:
            print("Re-run with --apply to commit.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deduplicate words and build word_topics links.")
    parser.add_argument("--apply", action="store_true", help="Commit changes (default is dry-run)")
    args = parser.parse_args()
    run(apply=args.apply)


if __name__ == "__main__":
    main()
