"""Preview/import Spanish reading hints. Explicit review is required to apply."""

import argparse
import json
import sys
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--reviewed",
        action="store_true",
        help="Operator accepts the approximate Cyrillic guides after review",
    )
    parser.add_argument("--expected-plan")
    args = parser.parse_args(argv)
    if args.report.resolve() in {args.data.resolve(), args.manifest.resolve()}:
        parser.error("Report must not overwrite the input files")
    if args.apply and (not args.reviewed or not args.expected_plan):
        parser.error("Applying requires --reviewed and --expected-plan from a fresh preview")
    committed = False
    try:
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        from app.features.words.pronunciation_import import apply_plan, build_plan, read_package
        from app.shared.db import engine

        if engine.dialect.name != "postgresql":
            raise ValueError("PostgreSQL is required; refusing SQLite fallback")
        entries, manifest = read_package(args.data, args.manifest)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        with engine.connect() as connection, Session(bind=connection) as db, db.begin():
            if not args.apply:
                db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            plan = (
                apply_plan(db, entries, args.expected_plan)
                if args.apply
                else build_plan(db, entries)
            )
            result = {
                **plan,
                "mode": "apply" if args.apply else "preview",
                "operator_reviewed": args.reviewed,
                "source_approved_for_import": manifest.get("review", {}).get(
                    "approved_for_import", False
                ),
            }
            args.report.write_text(
                json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            if plan["errors"]:
                print(json.dumps({"status": "blocked", "summary": plan["summary"]}))
                return 2
        committed = args.apply
        print(
            json.dumps(
                {
                    "status": result["mode"],
                    "summary": plan["summary"],
                    "plan_sha256": plan["plan_sha256"],
                }
            )
        )
        return 0
    except Exception as exc:  # noqa: BLE001 — sanitize errors at the operator boundary.
        # Do not print database exception payloads/connection details.
        print(
            json.dumps(
                {"status": "failed", "error_type": type(exc).__name__, "committed": committed}
            ),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
