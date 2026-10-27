"""Review and install eight starter libraries. Dry-run by default; PostgreSQL only."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("packages", nargs="+", type=Path, help="Reviewed UTF-8 JSONL files")
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-plan", help="Plan SHA256 from the reviewed dry-run")
    args = parser.parse_args(argv)
    if args.apply and not re.fullmatch(r"[a-f0-9]{64}", args.expected_plan or ""):
        parser.error("--apply requires --expected-plan with the reviewed SHA256")
    if args.report.resolve() in {path.resolve() for path in args.packages}:
        parser.error("The report must not overwrite an input package")
    committed = False
    try:
        # --help and argument checks never initialize application/database state.
        from app.features.languages.starter import (
            StarterImportError,
            apply_starter_libraries,
            build_starter_plan,
            read_starter_packages,
        )
        from app.shared.db import engine
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if engine.dialect.name != "postgresql":
            raise StarterImportError("Refusing an implicit SQLite fallback; PostgreSQL is required")
        entries = read_starter_packages(args.packages)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        isolation = "READ COMMITTED" if args.apply else "REPEATABLE READ"
        with engine.connect().execution_options(isolation_level=isolation) as connection:
            with Session(bind=connection) as db, db.begin():
                if not args.apply:
                    db.execute(text("SET TRANSACTION READ ONLY"))
                plan = build_starter_plan(db, entries)
                result = {**plan, "mode": "dry_run"}
                args.report.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                if plan["errors"]:
                    print(
                        json.dumps(
                            {
                                "status": "blocked",
                                "summary": plan["summary"],
                                "plan_sha256": plan["plan_sha256"],
                            }
                        )
                    )
                    return 2
                if args.apply:
                    result = {
                        **apply_starter_libraries(db, entries, args.expected_plan),
                        "mode": "pending_commit",
                    }
                    # An unwritable audit destination must abort before commit.
                    args.report.write_text(
                        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
                    )
            if args.apply:
                committed = True
                result["mode"] = "applied"
                args.report.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
                )
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
    except Exception as exc:  # noqa: BLE001 — sanitize database errors at the CLI boundary.
        # Database exceptions may contain connection details; never echo them.
        safe_error = (
            str(exc)
            if "StarterImportError" in locals() and isinstance(exc, StarterImportError)
            else type(exc).__name__
        )
        print(
            json.dumps(
                {
                    "status": "report_failed_after_commit" if committed else "failed",
                    "error": safe_error,
                    "committed": committed,
                }
            ),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
