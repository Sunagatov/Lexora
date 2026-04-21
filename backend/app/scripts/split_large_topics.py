"""
Bulk topic split driver for Lexora.

It reads the live topic audit from prod, selects topics with more than 300
active words, builds split plans with the existing refinement service, and
posts dry-run import payloads so the split can be reviewed topic by topic.

Use --live only after reviewing the dry-run artifacts.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

MAX_WORD_REASSIGNS_PER_IMPORT = 500
MIN_SPLIT_WORDS = 300


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "topic"


def _login(http: httpx.Client, base_url: str, password: str) -> str:
    resp = http.post(f"{base_url}/auth/login", json={"password": password})
    resp.raise_for_status()
    return resp.json()["csrf_token"]


def _fetch_json(http: httpx.Client, method: str, url: str, csrf: str, **kwargs: Any) -> dict[str, Any]:
    headers = dict(kwargs.pop("headers", {}))
    headers["X-CSRF-Token"] = csrf
    resp = http.request(method, url, headers=headers, **kwargs)
    resp.raise_for_status()
    return resp.json()


def _audit_topics(http: httpx.Client, base_url: str, csrf: str) -> list[dict[str, Any]]:
    data = _fetch_json(http, "GET", f"{base_url}/api/topics/audit", csrf)
    return list(data.get("items", []))


def _split_plan(
    http: httpx.Client,
    base_url: str,
    csrf: str,
    topic_id: int,
    *,
    max_new_topics: int,
) -> dict[str, Any]:
    return _fetch_json(
        http,
        "POST",
        f"{base_url}/api/topics/{topic_id}/split-plan",
        csrf,
        json={"max_new_topics": max_new_topics},
    )


def _build_topic_operations(plan: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    topic_operations: list[dict[str, Any]] = []
    client_keys_by_index: dict[str, str] = {}
    used_keys: set[str] = set()

    for index, subtopic in enumerate(plan.get("proposed_subtopics", [])):
        if not subtopic.get("is_new_topic"):
            continue
        base_key = _slugify(subtopic["name"])
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
                "is_active": True,
            }
        )

    return topic_operations, client_keys_by_index


def _build_word_reassigns(
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


def _chunk(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def _build_payload(
    *,
    source_topic_id: int,
    dry_run: bool,
    topic_operations: list[dict[str, Any]],
    word_reassigns: list[dict[str, Any]],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "schema_version": "lexora.ai-curation.v2",
        "source_topic_id": source_topic_id,
        "dry_run": dry_run,
        "strict_mode": False,
        "topic_operations": topic_operations,
        "word_updates": [],
        "word_creates": [],
        "word_reassigns": word_reassigns,
    }
    return payload


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _topic_artifact_dir(root: Path, topic: dict[str, Any]) -> Path:
    return root / f"topic-{topic['topic_id']}" / _slugify(topic["topic_name"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk split Lexora topics with more than 300 words.")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to prod (default)")
    parser.add_argument("--live", action="store_true", help="Commit changes to prod")
    parser.add_argument("--prod-url", default="https://lexora.zuf.uk")
    parser.add_argument("--max-new-topics", type=int, default=10, help="Maximum number of candidate subtopics per topic")
    parser.add_argument("--page-size", type=int, default=100, help="Reserved for future pagination compatibility")
    parser.add_argument("--artifacts-dir", default="backend/.artifacts/ai-curation/topic-splits")
    parser.add_argument(
        "--skip-topic-id",
        action="append",
        type=int,
        default=[],
        help="Skip a topic id. Repeatable.",
    )
    args = parser.parse_args()

    if not args.live and not args.dry_run:
        print("No mode specified — defaulting to --dry-run. Use --live to commit.")
        args.dry_run = True

    dry_run = not args.live
    password = os.environ.get("PROD_PASSWORD")
    if not password:
        sys.exit("Error: PROD_PASSWORD env var is required")

    artifacts_root = Path(args.artifacts_dir)
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    with httpx.Client(timeout=120) as http:
        print(f"Logging in to {args.prod_url} ...")
        csrf = _login(http, args.prod_url, password)
        print("Login OK\n")

        audit_items = _audit_topics(http, args.prod_url, csrf)
        candidates = [
            item for item in audit_items
            if item.get("word_count", 0) > MIN_SPLIT_WORDS and item.get("should_review")
        ]
        candidates.sort(key=lambda item: (-item["word_count"], item["topic_name"].casefold()))

        if not candidates:
            print("No topics above the split threshold.")
            return

        print(f"Found {len(candidates)} topics with more than {MIN_SPLIT_WORDS} active words.\n")

        summary: list[dict[str, Any]] = []
        skipped_ids = set(args.skip_topic_id)

        for topic in candidates:
            topic_id = topic["topic_id"]
            topic_name = topic["topic_name"]
            if topic_id in skipped_ids:
                print(f"Topic {topic_id}: {topic_name} ({topic['word_count']} words)")
                print("  skipped by request")
                summary.append(
                    {
                        "topic_id": topic_id,
                        "topic_name": topic_name,
                        "word_count": topic["word_count"],
                        "status": "skipped",
                        "reason": ["skipped by request"],
                    }
                )
                continue
            topic_dir = _topic_artifact_dir(artifacts_root, topic)
            topic_dir.mkdir(parents=True, exist_ok=True)

            print(f"Topic {topic_id}: {topic_name} ({topic['word_count']} words)")

            try:
                plan = _split_plan(
                    http,
                    args.prod_url,
                    csrf,
                    topic_id,
                    max_new_topics=args.max_new_topics,
                )
            except httpx.HTTPStatusError as exc:
                print(f"  skipped: split-plan failed with HTTP {exc.response.status_code}")
                _write_json(
                    topic_dir / "split-plan-error.json",
                    {
                        "status_code": exc.response.status_code,
                        "response_text": exc.response.text,
                    },
                )
                summary.append(
                    {
                        "topic_id": topic_id,
                        "topic_name": topic_name,
                        "word_count": topic["word_count"],
                        "status": "error",
                        "reason": [f"split-plan failed with HTTP {exc.response.status_code}"],
                    }
                )
                continue
            _write_json(topic_dir / "split-plan.json", plan)

            if not plan.get("should_split"):
                print("  skipped: no stable split plan")
                summary.append(
                    {
                        "topic_id": topic_id,
                        "topic_name": topic_name,
                        "word_count": topic["word_count"],
                        "status": "skipped",
                        "reason": plan.get("reasons", []),
                    }
                )
                continue

            topic_operations, client_keys_by_index = _build_topic_operations(plan)
            word_reassigns = _build_word_reassigns(plan, client_keys_by_index)
            batches = _chunk(word_reassigns, MAX_WORD_REASSIGNS_PER_IMPORT) or [[]]
            created_topic_ids: dict[str, int] = {}
            total_reassigned = 0
            total_created_topics = len(topic_operations)

            for batch_index, batch_word_reassigns in enumerate(batches, start=1):
                batch_topic_operations = topic_operations if dry_run or batch_index == 1 else []
                if not dry_run and batch_index > 1:
                    batch_word_reassigns = _build_word_reassigns(
                        plan,
                        client_keys_by_index,
                        created_topic_ids=created_topic_ids,
                    )[MAX_WORD_REASSIGNS_PER_IMPORT * (batch_index - 1) : MAX_WORD_REASSIGNS_PER_IMPORT * batch_index]

                payload = _build_payload(
                    source_topic_id=topic_id,
                    dry_run=dry_run,
                    topic_operations=batch_topic_operations,
                    word_reassigns=batch_word_reassigns,
                )

                batch_tag = f"batch-{batch_index:02d}"
                _write_json(topic_dir / f"{batch_tag}-import-request.json", payload)

                try:
                    response = _fetch_json(
                        http,
                        "POST",
                        f"{args.prod_url}/api/ai-curation/import",
                        csrf,
                        json=payload,
                    )
                except httpx.HTTPStatusError as exc:
                    print(f"  batch {batch_index:02d} failed with HTTP {exc.response.status_code}")
                    _write_json(
                        topic_dir / f"{batch_tag}-import-error.json",
                        {
                            "status_code": exc.response.status_code,
                            "response_text": exc.response.text,
                        },
                    )
                    summary.append(
                        {
                            "topic_id": topic_id,
                            "topic_name": topic_name,
                            "word_count": topic["word_count"],
                            "status": "error",
                            "reason": [f"import batch {batch_index} failed with HTTP {exc.response.status_code}"],
                            "artifact_dir": str(topic_dir),
                        }
                    )
                    break
                _write_json(topic_dir / f"{batch_tag}-import-response.json", response)

                if batch_index == 1 and not dry_run:
                    created_topic_ids = {item["client_key"]: item["id"] for item in response.get("created_topics", [])}

                total_reassigned += response.get("reassigned_words", 0)

            else:
                print(
                    f"  dry_run={dry_run} created_topics={total_created_topics} "
                    f"reassigned_words={total_reassigned}"
                )

                summary.append(
                    {
                        "topic_id": topic_id,
                        "topic_name": topic_name,
                        "word_count": topic["word_count"],
                        "status": "dry_run" if dry_run else "live",
                        "created_topics": total_created_topics,
                        "reassigned_words": total_reassigned,
                        "artifact_dir": str(topic_dir),
                    }
                )

        _write_json(artifacts_root / f"summary-{run_stamp}.json", summary)
        print(f"\nSummary written to {artifacts_root / f'summary-{run_stamp}.json'}")


if __name__ == "__main__":
    main()
