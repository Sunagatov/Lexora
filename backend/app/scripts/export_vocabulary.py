from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Any, cast

from openpyxl import Workbook
from sqlalchemy import select

from app.features.topics.model import Topic
from app.features.stats.model import WordProgressEvent  # noqa: F401 — registers the ORM class so Word.progress_events resolves
from app.features.words.model import Word
from app.shared.db import SessionLocal
from app.scripts.xlsx_export import write_sheet


def export_workbook(output_path: Path) -> None:
    wb = Workbook()
    default_sheet = wb.active
    assert default_sheet is not None
    wb.remove(default_sheet)

    with SessionLocal() as db:
        topics = list(cast(list[Topic], db.scalars(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.name)).all()))
        total_words = 0
        for topic in topics:
            topic_words = cast(
                Any,
                Word.topics,
            ).any(Topic.id == topic.id)
            words = list(
                cast(
                    list[Word],
                    db.scalars(
                        select(Word)
                        .where(Word.is_active.is_(True), topic_words)
                        .order_by(Word.term)
                    ).all(),
                )
            )
            if not words:
                continue
            write_sheet(wb, topic, words)
            total_words += len(words)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)

    print(f"\nExport complete: {output_path}")
    print(f"  Topics exported: {len(wb.sheetnames)}")
    print(f"  Words exported:  {total_words}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the Lexora database to an Excel workbook.")
    default_name = f"LexoraExport_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    parser.add_argument("output", type=Path, nargs="?", default=Path(f"/tmp/{default_name}"), help="Output .xlsx path")
    args = parser.parse_args()
    export_workbook(output_path=args.output)


if __name__ == "__main__":
    main()
