from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypeAlias, cast

import httpx

from app.features.words.constants import PROGRESS_SOURCE_JSON_IMPORT
from app.shared.auth import CSRF_HEADER_NAME

from app.shared.text import normalize_term
from app.scripts.split_large_topics_io import fetch_json, login, write_json

JsonDict: TypeAlias = dict[str, Any]
JsonList: TypeAlias = list[JsonDict]

PROD_URL = "https://lexora.zuf.uk"
ARTIFACT_DIR = Path("backend/.artifacts/animals-refinement")

ALLOWED_SUBTOPICS: list[tuple[str, str]] = [
    ("Pets", "Domestic animals people commonly keep at home."),
    ("Farm Animals", "Animals commonly kept on farms."),
    ("Birds", "Birds and bird-related vocabulary."),
    ("Fish & Sea Animals", "Fish, sea creatures, and animals that live mainly in water."),
    ("Reptiles & Amphibians", "Snakes, lizards, crocodiles, frogs, toads, turtles, tortoises, and similar animals."),
    ("Insects", "Insects and insect-related vocabulary."),
    ("Baby Animals", "Vocabulary for young animals and animal family words."),
    ("Animal Body Parts", "Animal-specific body parts and external features."),
    ("Animal Sounds & Movement", "Animal noises, movement verbs, and basic movement actions."),
    ("Animal Behaviour", "Vocabulary describing how animals behave, hunt, protect themselves, communicate, or interact."),
    ("Animal Care & Vets", "Vocabulary about vets, animal care, feeding, shelters, treatment, rescue, and pet/animal health."),
    ("Forest Animals", "Animals commonly associated with forests and woodland environments."),
    ("Jungle & Rainforest Animals", "Animals commonly associated with jungle and rainforest environments."),
    ("Mountain Animals", "Animals commonly associated with mountains and rocky highland environments."),
    ("Polar Animals", "Animals commonly associated with Arctic, Antarctic, and cold polar environments."),
    ("Desert Animals", "Animals commonly associated with deserts and dry environments."),
    ("Savanna Animals", "Animals commonly associated with savannas."),
    ("Grassland Animals", "Animals commonly associated with grasslands, plains, and open grassy environments."),
]

ALLOWED_BY_KEY = {normalize_term(name): {"name": name, "description": description} for name, description in ALLOWED_SUBTOPICS}

EXACT_TERM_SUBTOPICS: dict[str, str] = {
    "dog": "Pets",
    "cat": "Pets",
    "rabbit": "Pets",
    "hamster": "Pets",
    "guinea pig": "Pets",
    "pet": "Pets",
    "leash": "Pets",
    "lead": "Pets",
    "collar": "Pets",
    "litter tray": "Pets",
    "kennel": "Pets",
    "cow": "Farm Animals",
    "sheep": "Farm Animals",
    "goat": "Farm Animals",
    "pig": "Farm Animals",
    "horse": "Farm Animals",
    "chicken": "Farm Animals",
    "hen": "Farm Animals",
    "rooster": "Farm Animals",
    "duck": "Farm Animals",
    "goose": "Farm Animals",
    "turkey": "Farm Animals",
    "donkey": "Farm Animals",
    "bull": "Farm Animals",
    "farm animal": "Farm Animals",
    "livestock": "Farm Animals",
    "bird": "Birds",
    "eagle": "Birds",
    "owl": "Birds",
    "pigeon": "Birds",
    "swan": "Birds",
    "sparrow": "Birds",
    "penguin": "Birds",
    "feather": "Birds",
    "beak": "Birds",
    "wing": "Birds",
    "nest": "Birds",
    "fish": "Fish & Sea Animals",
    "whale": "Fish & Sea Animals",
    "dolphin": "Fish & Sea Animals",
    "shark": "Fish & Sea Animals",
    "octopus": "Fish & Sea Animals",
    "crab": "Fish & Sea Animals",
    "lobster": "Fish & Sea Animals",
    "jellyfish": "Fish & Sea Animals",
    "squid": "Fish & Sea Animals",
    "clam": "Fish & Sea Animals",
    "seahorse": "Fish & Sea Animals",
    "seal": "Fish & Sea Animals",
    "sea turtle": "Fish & Sea Animals",
    "snake": "Reptiles & Amphibians",
    "lizard": "Reptiles & Amphibians",
    "crocodile": "Reptiles & Amphibians",
    "alligator": "Reptiles & Amphibians",
    "frog": "Reptiles & Amphibians",
    "toad": "Reptiles & Amphibians",
    "salamander": "Reptiles & Amphibians",
    "turtle": "Reptiles & Amphibians",
    "tortoise": "Reptiles & Amphibians",
    "ant": "Insects",
    "bee": "Insects",
    "beetle": "Insects",
    "butterfly": "Insects",
    "caterpillar": "Insects",
    "dragonfly": "Insects",
    "fly": "Insects",
    "mosquito": "Insects",
    "spider": "Insects",
    "wasp": "Insects",
    "puppy": "Baby Animals",
    "kitten": "Baby Animals",
    "cub": "Baby Animals",
    "calf": "Baby Animals",
    "foal": "Baby Animals",
    "lamb": "Baby Animals",
    "chick": "Baby Animals",
    "paw": "Animal Body Parts",
    "tail": "Animal Body Parts",
    "fur": "Animal Body Parts",
    "claw": "Animal Body Parts",
    "hoof": "Animal Body Parts",
    "horn": "Animal Body Parts",
    "fang": "Animal Body Parts",
    "tusk": "Animal Body Parts",
    "bark": "Animal Sounds & Movement",
    "meow": "Animal Sounds & Movement",
    "moo": "Animal Sounds & Movement",
    "roar": "Animal Sounds & Movement",
    "chirp": "Animal Sounds & Movement",
    "hop": "Animal Sounds & Movement",
    "crawl": "Animal Sounds & Movement",
    "slither": "Animal Sounds & Movement",
    "swim": "Animal Sounds & Movement",
    "hibernate": "Animal Behaviour",
    "hunt": "Animal Behaviour",
    "camouflage": "Animal Behaviour",
    "migrate": "Animal Behaviour",
    "territorial": "Animal Behaviour",
    "vet": "Animal Care & Vets",
    "veterinarian": "Animal Care & Vets",
    "shelter": "Animal Care & Vets",
    "rescue": "Animal Care & Vets",
    "feed": "Animal Care & Vets",
    "feeding": "Animal Care & Vets",
    "groom": "Animal Care & Vets",
    "vaccination": "Animal Care & Vets",
    "deer": "Forest Animals",
    "fox": "Forest Animals",
    "bear": "Forest Animals",
    "wolf": "Forest Animals",
    "squirrel": "Forest Animals",
    "tiger": "Jungle & Rainforest Animals",
    "gorilla": "Jungle & Rainforest Animals",
    "monkey": "Jungle & Rainforest Animals",
    "orangutan": "Jungle & Rainforest Animals",
    "jaguar": "Jungle & Rainforest Animals",
    "yak": "Mountain Animals",
    "mountain goat": "Mountain Animals",
    "polar bear": "Polar Animals",
    "penguin habitat": "Polar Animals",
    "camel": "Desert Animals",
    "scorpion": "Desert Animals",
    "fennec fox": "Desert Animals",
    "lion": "Savanna Animals",
    "zebra": "Savanna Animals",
    "giraffe": "Savanna Animals",
    "elephant": "Savanna Animals",
    "buffalo": "Savanna Animals",
    "bison": "Grassland Animals",
    "prairie dog": "Grassland Animals",
    "antelope": "Grassland Animals",
}


def _require_password() -> str:
    password = os.environ.get("PROD_PASSWORD")
    if not password:
        sys.exit("Blocked: production access/configuration is unavailable")
    return password


def _fetch_bytes(http: httpx.Client, url: str, csrf: str) -> bytes:
    response = http.get(url, headers={CSRF_HEADER_NAME: csrf})
    response.raise_for_status()
    return response.content


def _active_topics(topics: JsonList) -> JsonList:
    return [topic for topic in topics if topic.get("deleted_at") is None]


def _topic_by_name(topics: JsonList, name: str) -> JsonDict | None:
    target = normalize_term(name)
    matches = [topic for topic in topics if normalize_term(str(topic["name"])) == target]
    if not matches:
        return None
    if len(matches) > 1:
        sys.exit(f"Blocked: multiple active topics named {name!r} exist")
    return matches[0]


def _children_by_parent(topics: JsonList) -> dict[int | None, JsonList]:
    result: dict[int | None, JsonList] = defaultdict(list)
    for topic in topics:
        result[topic.get("parent_topic_id")].append(topic)
    return result


def _descendants(children: dict[int | None, JsonList], root_id: int) -> JsonList:
    result: JsonList = []
    stack = list(children.get(root_id, []))
    while stack:
        topic = stack.pop()
        result.append(topic)
        stack.extend(children.get(topic["id"], []))
    return result


def _metadata_blob(word: JsonDict) -> str:
    parts = [
        str(word.get("term") or ""),
        str(word.get("translations") or ""),
        str(word.get("pattern") or ""),
        str(word.get("example") or ""),
        str(word.get("notes") or ""),
        " ".join(word.get("example_entries") or []),
    ]
    return normalize_term(" ".join(parts))


def _classify_word(word: JsonDict, allowed_topic_ids: dict[str, int], current_animals_topics: JsonList) -> int:
    term = normalize_term(str(word["term"]))
    blob = _metadata_blob(word)

    if term == "parrot":
        chosen = "Pets" if "pet" in blob else "Birds"
        return allowed_topic_ids[chosen]
    if term == "goldfish":
        if "pet" in blob:
            return allowed_topic_ids["Pets"]
        return allowed_topic_ids["Fish & Sea Animals"]

    direct = EXACT_TERM_SUBTOPICS.get(term)
    if direct is not None:
        return allowed_topic_ids[direct]

    for topic in current_animals_topics:
        name = str(topic["name"])
        if name in allowed_topic_ids:
            return allowed_topic_ids[name]

    return allowed_topic_ids["Animals"]


def _write_artifacts(
    artifact_dir: Path,
    *,
    topics: JsonList,
    animals_words: JsonList,
    duplicates: dict[str, list[int]],
    plan: JsonDict,
) -> None:
    write_json(artifact_dir / "topics.json", topics)
    write_json(artifact_dir / "animals-words.json", animals_words)
    write_json(artifact_dir / "duplicate-terms.json", duplicates)
    write_json(artifact_dir / "plan.json", plan)


def _validate_structure(topics: JsonList, animals_id: int) -> None:
    children = [topic for topic in topics if topic.get("parent_topic_id") == animals_id and topic.get("deleted_at") is None]
    counts: dict[str, int] = defaultdict(int)
    for child in children:
        counts[str(child["name"])] += 1

    for allowed_name, _ in ALLOWED_SUBTOPICS:
        if counts.get(allowed_name, 0) != 1:
            sys.exit(f"Blocked: validation failed for Animals subtopic {allowed_name!r}")

    descendants = _descendants(_children_by_parent(topics), animals_id)
    disallowed = [topic["name"] for topic in descendants if str(topic["name"]) not in {name for name, _ in ALLOWED_SUBTOPICS}]
    if disallowed:
        sys.exit(f"Blocked: validation failed because disallowed Animals subtopics remain: {sorted(disallowed)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Refine the Animals topic through the Lexora API.")
    parser.add_argument("--dry-run", action="store_true", help="Preview only and write artifacts")
    parser.add_argument("--live", action="store_true", help="Apply changes through the API")
    parser.add_argument("--prod-url", default=PROD_URL)
    parser.add_argument("--artifacts-dir", default=str(ARTIFACT_DIR))
    args = parser.parse_args()

    if not args.live and not args.dry_run:
        args.dry_run = True

    password = _require_password()
    artifact_dir = Path(args.artifacts_dir) / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    artifact_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=120) as http:
        csrf = login(http, args.prod_url, password)
        topics = _active_topics(cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/topics", csrf)))
        animals = _topic_by_name(topics, "Animals")
        if animals is None:
            sys.exit("Blocked: Animals topic does not exist")

        all_words = cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/words", csrf))
        deleted_words = cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/trash/words", csrf))
        duplicates: dict[str, list[int]] = defaultdict(list)
        for word in all_words + deleted_words:
            duplicates[normalize_term(str(word["term"]))].append(int(word["id"]))
        duplicate_groups = {term: ids for term, ids in duplicates.items() if len(ids) > 1}

        animals_words = fetch_json(http, "GET", f"{args.prod_url}/api/words?topic_id={animals['id']}", csrf)
        children = _children_by_parent(topics)
        descendant_topics = _descendants(children, int(animals["id"]))
        descendant_ids = {int(topic["id"]) for topic in descendant_topics} | {int(animals["id"])}

        existing_allowed: dict[str, JsonDict] = {}
        disallowed_topics: JsonList = []
        for topic in descendant_topics:
            key = normalize_term(str(topic["name"]))
            if key in ALLOWED_BY_KEY and key not in existing_allowed:
                existing_allowed[key] = topic
            elif key in ALLOWED_BY_KEY:
                sys.exit(f"Blocked: duplicate Animals subtopic {topic['name']!r} already exists")
            else:
                disallowed_topics.append(topic)

        allowed_topic_ids = {"Animals": int(animals["id"])}
        creates: JsonList = []
        topic_updates: JsonList = []
        for name, description in ALLOWED_SUBTOPICS:
            key = normalize_term(name)
            existing = existing_allowed.get(key)
            if existing is None:
                global_match = _topic_by_name(topics, name)
                if global_match is not None:
                    sys.exit(f"Blocked: active topic {name!r} already exists outside Animals")
                creates.append(
                    {"name": name, "description": description, "parent_topic_id": int(animals["id"]), "is_active": True}
                )
                continue
            allowed_topic_ids[name] = int(existing["id"])
            payload: JsonDict = {}
            if existing.get("parent_topic_id") != int(animals["id"]):
                payload["parent_topic_id"] = int(animals["id"])
            if existing.get("name") != name:
                payload["name"] = name
            if (existing.get("description") or None) != description:
                payload["description"] = description
            if payload:
                topic_updates.append({"id": int(existing["id"]), "payload": payload})

        for name, _ in ALLOWED_SUBTOPICS:
            if name not in allowed_topic_ids:
                allowed_topic_ids[name] = -1

        word_updates: JsonList = []
        before_word_ids = sorted(int(word["id"]) for word in animals_words)
        for word in animals_words:
            current_animals_topics = [topic for topic in descendant_topics if int(topic["id"]) in set(word.get("topic_ids") or [])]
            target_animals_topic_id = _classify_word(word, allowed_topic_ids, current_animals_topics)
            non_animals_topic_ids = sorted(topic_id for topic_id in word.get("topic_ids", []) if int(topic_id) not in descendant_ids)
            target_topic_ids = sorted(non_animals_topic_ids + [target_animals_topic_id])
            if sorted(word.get("topic_ids") or []) != target_topic_ids:
                word_updates.append(
                    {
                        "id": int(word["id"]),
                        "payload": {"topic_ids": target_topic_ids, "progress_source": PROGRESS_SOURCE_JSON_IMPORT},
                    }
                )

        deletes = sorted(disallowed_topics, key=lambda topic: len(_descendants(children, int(topic["id"]))))
        plan = {
            "animals_topic_id": int(animals["id"]),
            "creates": creates,
            "topic_updates": topic_updates,
            "word_updates": word_updates,
            "delete_topic_ids": [int(topic["id"]) for topic in deletes],
        }
        _write_artifacts(
            artifact_dir,
            topics=topics,
            animals_words=animals_words,
            duplicates=duplicate_groups,
            plan=plan,
        )

        backup_name = artifact_dir / "backup.xlsx"
        backup_name.write_bytes(_fetch_bytes(http, f"{args.prod_url}/api/words/export/xlsx", csrf))

        if duplicate_groups:
            sys.exit("Blocked: duplicate vocabulary items exist and safe merge rules are unclear")

        if args.dry_run:
            return

        for payload in creates:
            created = fetch_json(http, "POST", f"{args.prod_url}/api/topics", csrf, json=payload)
            allowed_topic_ids[str(created["name"])] = int(created["id"])

        for update in topic_updates:
            fetch_json(http, "PUT", f"{args.prod_url}/api/topics/{update['id']}", csrf, json=update["payload"])

        refreshed_topics = _active_topics(cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/topics", csrf)))
        refreshed_animals = _topic_by_name(refreshed_topics, "Animals")
        if refreshed_animals is None:
            sys.exit("Blocked: Animals topic disappeared during apply")

        refreshed_descendants = _descendants(_children_by_parent(refreshed_topics), int(refreshed_animals["id"]))
        refreshed_allowed_ids = {"Animals": int(refreshed_animals["id"])}
        for topic in refreshed_descendants:
            if str(topic["name"]) in {name for name, _ in ALLOWED_SUBTOPICS}:
                refreshed_allowed_ids[str(topic["name"])] = int(topic["id"])

        refreshed_words = cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/words?topic_id={refreshed_animals['id']}", csrf))
        for word in refreshed_words:
            current_animals_topics = [topic for topic in refreshed_descendants if int(topic["id"]) in set(word.get("topic_ids") or [])]
            target_animals_topic_id = _classify_word(word, refreshed_allowed_ids, current_animals_topics)
            refreshed_descendant_ids = {int(topic["id"]) for topic in refreshed_descendants} | {int(refreshed_animals["id"])}
            non_animals_topic_ids = sorted(topic_id for topic_id in word.get("topic_ids", []) if int(topic_id) not in refreshed_descendant_ids)
            target_topic_ids = sorted(non_animals_topic_ids + [target_animals_topic_id])
            if sorted(word.get("topic_ids") or []) != target_topic_ids:
                fetch_json(
                    http,
                    "PUT",
                    f"{args.prod_url}/api/words/{word['id']}",
                    csrf,
                    json={"topic_ids": target_topic_ids, "progress_source": PROGRESS_SOURCE_JSON_IMPORT},
                )

        latest_topics = _active_topics(cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/topics", csrf)))
        latest_children = _children_by_parent(latest_topics)
        latest_animals = _topic_by_name(latest_topics, "Animals")
        if latest_animals is None:
            sys.exit("Blocked: Animals topic disappeared before delete step")

        latest_descendants = _descendants(latest_children, int(latest_animals["id"]))
        delete_ids = [
            int(topic["id"])
            for topic in sorted(latest_descendants, key=lambda topic: len(_descendants(latest_children, int(topic["id"]))))
            if normalize_term(str(topic["name"])) not in ALLOWED_BY_KEY
        ]
        for topic_id in delete_ids:
            response = http.delete(
                f"{args.prod_url}/api/topics/{topic_id}",
                params={"delete_words": "false"},
                headers={CSRF_HEADER_NAME: csrf},
            )
            response.raise_for_status()

        final_topics = _active_topics(cast(JsonList, fetch_json(http, "GET", f"{args.prod_url}/api/topics", csrf)))
        _validate_structure(final_topics, int(latest_animals["id"]))
        final_words = fetch_json(http, "GET", f"{args.prod_url}/api/words?topic_id={latest_animals['id']}", csrf)
        after_word_ids = sorted(int(word["id"]) for word in final_words)
        if before_word_ids != after_word_ids:
            sys.exit("Blocked: validation failed because Animals word IDs changed")

        write_json(
            artifact_dir / "validation.json",
            {
                "validated_at": datetime.now(timezone.utc).isoformat(),
                "animals_topic_id": int(latest_animals["id"]),
                "word_count": len(final_words),
            },
        )


if __name__ == "__main__":
    main()
