"""Content-only workbook synchronization. Dry-run by default; no credentials in arguments."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path, nargs="?")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument(
        "--resolutions",
        type=Path,
        help="JSON: Word ID -> field -> explicitly selected observed value",
    )
    parser.add_argument("--restore-backup", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--include-related-topics",
        action="store_true",
        help="Include reviewed exact-name Related annotations for existing topics",
    )
    parser.add_argument(
        "--skip-conflicts",
        action="store_true",
        help="Explicitly leave every conflicted Word ID unchanged",
    )
    parser.add_argument(
        "--expected-plan", help="SHA256 from the reviewed dry-run report; required with --apply"
    )
    parser.add_argument(
        "--backup", type=Path, help="New recovery snapshot path; required with --apply"
    )
    args = parser.parse_args(argv)
    if bool(args.workbook) == bool(args.restore_backup):
        parser.error("Specify a workbook or --restore-backup, but not both")
    if args.apply and (not args.expected_plan or not args.backup):
        parser.error("--apply requires --expected-plan and a new --backup path")
    inputs = {
        path.resolve() for path in (args.workbook, args.resolutions, args.restore_backup) if path
    }
    if args.report.resolve() in inputs or (
        args.backup and args.backup.resolve() in inputs | {args.report.resolve()}
    ):
        parser.error("Reports and recovery snapshots must not overwrite input files or each other")
    committed = False
    validation_errors = ()
    try:
        # Argument validation and --help must not initialize the application DB.
        from app.features.words.workbook.format import InvalidWorkbookError
        from app.features.words.workbook.sync_rows import read_sync_workbook

        validation_errors = (InvalidWorkbookError,)
        source = None
        if args.workbook:
            resolutions = (
                json.loads(args.resolutions.read_text(encoding="utf-8"))
                if args.resolutions
                else None
            )
            source = read_sync_workbook(args.workbook.read_bytes(), resolutions)
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        from app.features.words.workbook.sync import (
            apply_sync_plan,
            build_restore_plan,
            build_sync_plan,
            write_recovery_snapshot,
        )
        from app.shared.db import USING_SQLITE_FALLBACK, engine

        if USING_SQLITE_FALLBACK:
            raise InvalidWorkbookError(
                "PostgreSQL is unavailable; refusing implicit SQLite fallback"
            )
        args.report.parent.mkdir(parents=True, exist_ok=True)
        # A stable snapshot prevents concurrent progress activity from affecting verification.
        with engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with Session(bind=connection) as db, db.begin():
                if not args.apply:
                    db.execute(text("SET TRANSACTION READ ONLY"))
                plan = (
                    build_restore_plan(db, args.restore_backup, lock=args.apply)
                    if args.restore_backup
                    else build_sync_plan(
                        db,
                        source,
                        lock=args.apply,
                        include_related_topics=args.include_related_topics,
                    )
                )
                args.report.write_text(
                    json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                if plan["errors"] or (plan["conflicts"] and not args.skip_conflicts):
                    print(
                        json.dumps(
                            {
                                "status": "blocked",
                                "summary": plan["summary"],
                                "errors": len(plan["errors"]),
                                "conflicts": len(plan["conflicts"]),
                                "plan_sha256": plan["plan_sha256"],
                            }
                        )
                    )
                    return 2
                result = plan
                if args.apply:
                    if args.expected_plan != plan["plan_sha256"]:
                        raise InvalidWorkbookError(
                            "Plan changed since review; inspect the new dry-run report"
                        )
                    backup_checksum = write_recovery_snapshot(args.backup, plan)
                    result = apply_sync_plan(db, plan, skip_conflicts=args.skip_conflicts)
                    result["recovery_snapshot_sha256"] = backup_checksum
                    result["mode"] = "pending_commit"
                # Write before commit: an unwritable audit destination also aborts the transaction.
                args.report.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
                )
            # Only the successful transaction exit confirms commit.
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
                        "summary": result["summary"],
                        "plan_sha256": result["plan_sha256"],
                    }
                )
            )
        return 0
    except Exception as exc:  # noqa: BLE001 -- operator boundary must not echo driver credentials
        # Avoid echoing driver exceptions that may contain runtime connection details.
        safe_error = str(exc) if isinstance(exc, validation_errors) else type(exc).__name__
        print(
            json.dumps({"status": "failed", "committed": committed, "error": safe_error}),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
