from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import select

from app.features.topics.model import Topic
from app.features.words.model import Word
from app.shared.db import SessionLocal
from app.scripts.xlsx_export import write_sheet


def export_workbook(output_path: Path) -> None:
    wb = Workbook()
    wb.remove(wb.active)

    with SessionLocal() as db:
        topics = list(db.scalars(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.name)))
        total_words = 0
        for topic in topics:
            words = list(db.scalars(select(Word).where(Word.topic_id == topic.id, Word.is_active.is_(True))))
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
