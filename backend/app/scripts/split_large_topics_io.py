from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "topic"


def login(http: httpx.Client, base_url: str, password: str) -> str:
    resp = http.post(f"{base_url}/auth/login", json={"password": password})
    resp.raise_for_status()
    return resp.json()["csrf_token"]


def fetch_json(http: httpx.Client, method: str, url: str, csrf: str, **kwargs: Any) -> Any:
    headers = dict(kwargs.pop("headers", {}))
    headers["X-CSRF-Token"] = csrf
    resp = http.request(method, url, headers=headers, **kwargs)
    resp.raise_for_status()
    return resp.json()


def audit_topics(http: httpx.Client, base_url: str, csrf: str) -> list[dict[str, Any]]:
    data = fetch_json(http, "GET", f"{base_url}/api/topics/audit", csrf)
    return list(data.get("items", []))


def split_plan(
    http: httpx.Client,
    base_url: str,
    csrf: str,
    topic_id: int,
    *,
    max_new_topics: int,
) -> dict[str, Any]:
    return fetch_json(
        http,
        "POST",
        f"{base_url}/api/topics/{topic_id}/split-plan",
        csrf,
        json={"max_new_topics": max_new_topics},
    )


def build_topic_operations(plan: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    topic_operations: list[dict[str, Any]] = []
    client_keys_by_index: dict[str, str] = {}
    used_keys: set[str] = set()

    for index, subtopic in enumerate(plan.get("proposed_subtopics", [])):
        if not subtopic.get("is_new_topic"):
            continue
        base_key = slugify(subtopic["name"])
        client_key = f"{base_key}-{plan['source_topic_id']}-{index + 1}"
        suffix = 2
        while client_key in used_keys:
            client_key = f"{base_key}-{plan['source_topic_id']}-{index + 1}-{suffix}"
            suffix += 1
        used_keys.add(client_key)
        client_keys_by_index[str(index)] = client_key
        topic_operations.append(
            {
                "op": "create_topic",
                "client_key": client_key,
                "name": subtopic["name"],
                "description": subtopic.get("description"),
                "parent_topic_id": plan["source_topic_id"],
                "is_active": True,
            }
        )

    return topic_operations, client_keys_by_index


def build_word_reassigns(
    plan: dict[str, Any],
    client_keys_by_index: dict[str, str],
    *,
    created_topic_ids: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    word_reassigns: list[dict[str, Any]] = []
    for index, subtopic in enumerate(plan.get("proposed_subtopics", [])):
        if subtopic.get("is_new_topic"):
            client_key = client_keys_by_index[str(index)]
            if created_topic_ids is None:
                topic_ref: dict[str, Any] = {"client_key": client_key}
            else:
                topic_id = created_topic_ids.get(client_key)
                if topic_id is None:
                    raise RuntimeError(f"Missing created topic id for client_key '{client_key}'")
                topic_ref = {"topic_id": topic_id}
        else:
            topic_ref = {"topic_id": subtopic["topic_id"]}

        for word_id in subtopic.get("word_ids", []):
            word_reassigns.append(
                {
                    "id": word_id,
                    "add_topic_refs": [topic_ref],
                    "remove_topic_ids": [],
                }
            )

    return word_reassigns


def chunk(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def build_payload(
    *,
    source_topic_id: int,
    dry_run: bool,
    topic_operations: list[dict[str, Any]],
    word_reassigns: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schema_version": "lexora.ai-curation.v2",
        "source_topic_id": source_topic_id,
        "dry_run": dry_run,
        "strict_mode": False,
        "topic_operations": topic_operations,
        "word_updates": [],
        "word_creates": [],
        "word_reassigns": word_reassigns,
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def topic_artifact_dir(root: Path, topic: dict[str, Any]) -> Path:
    return root / f"topic-{topic['topic_id']}" / slugify(topic["topic_name"])
