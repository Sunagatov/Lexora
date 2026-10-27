"""Resolve identities once, collect every error, and describe exact content changes."""

from collections import defaultdict
from copy import deepcopy
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.features.languages.catalog import learning_language, translation_language
from app.features.topics.model import Topic
from app.features.words.model import Word
from app.features.words.workbook.import_source import issue
from app.features.words.workbook.sync import canonical_json, content_state
from app.shared.text import normalize_term, slugify


def build_import_plan(
    db: Session, source: dict, *, mode: str, minimum_translations: int = 4, lock: bool = False
) -> dict:
    topic_query, word_query = select(Topic).where(Topic.language == learning_language(db)), select(Word).where(Word.language == learning_language(db)).order_by(Word.id)
    if lock:
        topic_query, word_query = topic_query.with_for_update(), word_query.with_for_update(of=Word)
    topics = {topic.id: topic for topic in db.scalars(topic_query).all()}
    words = {word.id: word for word in db.scalars(word_query).all()}
    requested_terms = {normalize_term(row["term"]) for row in source["rows"]}
    requested_ids = {row["word_id"] for row in source["rows"] if row["word_id"] is not None}
    requested_ids.update(
        word.id for word in words.values() if normalize_term(word.term) in requested_terms
    )
    if requested_ids:
        # Load content once for the relevant words, not every word for each incoming row.
        db.scalars(
            select(Word)
            .where(Word.id.in_(requested_ids))
            .options(
                selectinload(Word.topics),
                selectinload(Word.translation_items),
                selectinload(Word.example_items),
            )
        ).all()
    plan = {
        "language": learning_language(db),
        "translation_language": translation_language(db),
        "mode": mode,
        "minimum_translations": minimum_translations,
        "workbook_sha256": source["sha256"],
        "errors": list(source["errors"]),
        "warnings": list(source["warnings"]),
        "topics": [],
        "entries": [],
        "summary": {
            "rows": len(source["rows"]),
            "created": 0,
            "updated": 0,
            "unchanged": 0,
            "topics_created": 0,
        },
    }
    topic_names = defaultdict(list)
    context = source.get("language_context")
    if context and context != {"language": learning_language(db), "translation_language": translation_language(db)}:
        plan["errors"].append(issue("Workbook", 0, "This workbook was exported for another learning or translation language. Switch to its languages before importing."))
    for topic in topics.values():
        topic_names[topic.name.casefold()].append(topic)
    new_topics = {}
    slugs = {topic.slug for topic in topics.values()}
    for item in source["topics"]:
        if item["id"] is not None:
            if item["id"] not in topics or topics[item["id"]].deleted_at is not None:
                plan["errors"].append(
                    issue(item["sheet"], item["row"], "Unknown or deleted Topic ID")
                )
            continue
        candidates = topic_names.get(item["name"].casefold(), [])
        if candidates:
            continue  # Existing topics are references, never renamed or reparented by imports.
        slug = slugify(item["name"], max_len=100)
        if not slug or slug in slugs or item["name"].casefold() in new_topics:
            plan["errors"].append(
                issue(
                    item["sheet"],
                    item["row"],
                    "Duplicate or conflicting topic name; use a unique name",
                )
            )
            continue
        parent = item["parent_topic_id"]
        if parent is not None and (parent not in topics or topics[parent].deleted_at is not None):
            plan["errors"].append(
                issue(item["sheet"], item["row"], "New topic requires an existing active Parent ID")
            )
            continue
        new = {
            "name": item["name"],
            "slug": slug,
            "parent_topic_id": parent,
            "description": item["description"],
        }
        new_topics[item["name"].casefold()] = new
        slugs.add(slug)
    by_term = defaultdict(list)
    for word in words.values():
        by_term[normalize_term(word.term)].append(word)
    entries = {}
    for row in source["rows"]:
        location = {"sheet": row["sheet"], "row": row["row"]}
        refs = []
        row_errors = []
        for ref in row["topic_refs"]:
            if ref.startswith("id:"):
                try:
                    topic_id = int(ref[3:])
                    topic = topics.get(topic_id)
                    if not topic or topic.deleted_at is not None:
                        raise ValueError()
                    refs.append(str(topic_id))
                except ValueError:
                    row_errors.append("Unknown or deleted topic: " + ref[3:])
            else:
                name = ref[5:]
                candidates = topic_names.get(name.casefold(), [])
                if len(candidates) == 1 and candidates[0].deleted_at is None:
                    refs.append(str(candidates[0].id))
                elif name.casefold() in new_topics:
                    refs.append("new:" + name.casefold())
                else:
                    row_errors.append(
                        "Unknown, deleted or ambiguous topic: "
                        + name
                        + "; add new topics to the Topics sheet"
                    )
        word = words.get(row["word_id"]) if row["word_id"] is not None else None
        if row["word_id"] is not None:
            if word is None or word.deleted_at is not None:
                row_errors.append("Unknown or deleted Word ID")
        else:
            matches = by_term.get(normalize_term(row["term"]), [])
            pos = row["fields"].get("part_of_speech")
            matches = [
                item
                for item in matches
                if item.language == learning_language(db)
                and (
                    pos is None
                    or (item.part_of_speech.name if item.part_of_speech else None) == pos
                )
            ]
            if len(matches) > 1 or (matches and matches[0].deleted_at is not None):
                row_errors.append(
                    "Ambiguous or deleted matching word; supply its exported Word ID or restore it first"
                )
            elif matches:
                word = matches[0]
                # A blank ID must not silently replace another sense of an existing word.
                if any(
                    row["fields"].get(name) != content_state(word, translation_language(db))[name]
                    for name in ("translations", "definition")
                    if name in row["fields"]
                ):
                    row_errors.append(
                        "Existing word has different content; supply its Word ID to confirm this update"
                    )
        for message in row_errors:
            plan["errors"].append(issue(**location, message=message))
        if row_errors:
            continue
        key = (
            str(word.id)
            if word
            else "new:"
            + normalize_term(row["term"])
            + ":"
            + str(row["fields"].get("part_of_speech"))
        )
        if key not in entries:
            before = content_state(word, translation_language(db)) if word else None
            entries[key] = {
                "key": key,
                "word_id": word.id if word else None,
                "locations": [],
                "before": before,
                "incoming": {},
                "refs": set(),
                "term": row["term"],
            }
        entry = entries[key]
        entry["locations"].append(location)
        entry["refs"].update(refs)
        incoming = {"term": row["term"], **row["fields"]}
        if word and mode == "add":
            incoming = {}  # Existing content and progress are protected in add-only mode.
        for name, value in incoming.items():
            if name in entry["incoming"] and entry["incoming"][name] != value:
                plan["errors"].append(
                    issue(
                        **location,
                        message=f"Conflicting {name} for shared word '{row['term']}'; edit its rows consistently",
                    )
                )
            entry["incoming"][name] = value
    planned_identities = {}
    for entry in entries.values():
        before = entry["before"]
        after = (
            deepcopy(before)
            if before
            else {
                "term": entry["term"],
                "translations": [],
                "examples": [],
                "topic_ids": [],
                "part_of_speech": None,
                **{
                    name: None
                    for name in (
                        "definition",
                        "pattern",
                        "countability",
                        "cefr_level",
                        "register",
                        "notes",
                    )
                },
            }
        )
        incoming = entry.pop("incoming")
        after.update(incoming)
        if (
            before
            and before["part_of_speech"] != after["part_of_speech"]
            and after["part_of_speech"] != "noun"
            and "countability" not in incoming
        ):
            after["countability"] = None
        refs = entry.pop("refs") | {str(tid) for tid in after.pop("topic_ids")}
        after["topic_ids"] = sorted(refs)
        if before:
            before["topic_ids"] = sorted(str(tid) for tid in before["topic_ids"])
        location = entry["locations"][0]
        if not after["translations"]:
            plan["errors"].append(
                issue(**location, message="New words require at least one translation")
            )
        if after["countability"] and after["part_of_speech"] != "noun":
            plan["errors"].append(
                issue(**location, message="Countability requires noun part of speech")
            )
        identity = (normalize_term(after["term"]), after["part_of_speech"])
        changed_identity = (
            not before or (normalize_term(before["term"]), before["part_of_speech"]) != identity
        )
        previous_identity = planned_identities.get(identity)
        if (
            previous_identity
            and previous_identity[0] != entry["key"]
            and (changed_identity or previous_identity[1])
        ):
            plan["errors"].append(
                issue(
                    **location, message="Two different Word IDs would end up with the same word/POS"
                )
            )
        planned_identities[identity] = (entry["key"], changed_identity)
        collisions = [
            item.id
            for item in by_term.get(identity[0], [])
            if item.id != entry["word_id"]
            and item.language == learning_language(db)
            and (item.part_of_speech.name if item.part_of_speech else None) == identity[1]
        ]
        if collisions and changed_identity:
            plan["errors"].append(
                issue(**location, message=f"Word/POS conflicts with existing IDs {collisions}")
            )
        if len(after["translations"]) < minimum_translations:
            plan["warnings"].append(
                issue(
                    **location,
                    message=f"{after['term']}: {len(after['translations'])} translations; requested {minimum_translations}. Review meaning, do not add filler.",
                )
            )
        if len(after["examples"]) < 3:
            plan["warnings"].append(
                issue(**location, message=f"{after['term']}: fewer than 3 examples")
            )
        entry["after"] = after
        entry["action"] = "create" if not before else "unchanged" if before == after else "update"
        plan["summary"][
            {"create": "created", "update": "updated", "unchanged": "unchanged"}[entry["action"]]
        ] += 1
        plan["entries"].append(entry)
    # Only create declared topics actually referenced by a word.
    used = {
        ref[4:]
        for entry in plan["entries"]
        for ref in entry["after"]["topic_ids"]
        if ref.startswith("new:")
    }
    plan["topics"] = [new_topics[key] for key in sorted(used)]
    plan["summary"]["topics_created"] = len(plan["topics"])
    plan["topic_labels"] = {str(topic.id): topic.name for topic in topics.values()}
    plan["topic_labels"].update({"new:" + key: value["name"] for key, value in new_topics.items()})
    plan["plan_hash"] = sha256(canonical_json(plan)).hexdigest()
    return plan
