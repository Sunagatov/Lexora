from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.topic import Topic
from app.models.word import Word

# ── Column headers per part-of-speech ────────────────────────────────────────

HEADERS: dict[str, tuple[str, ...]] = {
    "verb": (
        "Knowledge",
        "Word",
        "Russian translations",
        "Typical prepositions / patterns",
        "Examples (EN + RU)",
    ),
    "irregular_verb": (
        "Knowledge",
        "Base form",
        "Past Simple",
        "Past Participle",
        "Russian translations",
        "Typical prepositions / patterns",
        "Examples (EN + RU)",
    ),
    "noun": (
        "Knowledge",
        "Word",
        "Russian translations",
        "Countability",
    ),
    "adjective": (
        "Knowledge",
        "Word",
        "Russian translations",
    ),
    "preposition": (
        "Knowledge",
        "Word",
        "Russian translations",
    ),
    "phrase": (
        "Knowledge",
        "Phrase",
        "Russian translations",
        "Meaning / usage note",
    ),
    "adverb": (
        "Knowledge",
        "Word",
        "Russian translations",
        "Typical position / usage",
    ),
}

HEADER_FILL = PatternFill("solid", fgColor="1E293B")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=10)
HEADER_ALIGN = Alignment(horizontal="left", vertical="center")


def detect_sheet_type(words: list[Word]) -> str:
    """Infer the sheet type from the words in a topic."""
    pos_set = {w.part_of_speech for w in words if w.part_of_speech}

    if "verb" in pos_set:
        # irregular verbs have past_simple populated
        if any(w.past_simple for w in words):
            return "irregular_verb"
        return "verb"
    if "noun" in pos_set:
        return "noun"
    if "adjective" in pos_set:
        return "adjective"
    if "preposition" in pos_set:
        return "preposition"
    if "phrase" in pos_set:
        return "phrase"
    if "adverb" in pos_set:
        return "adverb"

    # fallback: noun layout
    return "noun"


def word_to_row(word: Word, sheet_type: str) -> tuple:
    level = word.knowledge_level or 1

    if sheet_type == "verb":
        return (level, word.term, word.translations, word.pattern, word.example)

    if sheet_type == "irregular_verb":
        return (level, word.term, word.past_simple, word.past_participle, word.translations, word.pattern, word.example)

    if sheet_type == "noun":
        return (level, word.term, word.translations, word.countability)

    if sheet_type in ("adjective", "preposition"):
        return (level, word.term, word.translations)

    if sheet_type == "phrase":
        return (level, word.term, word.translations, word.notes)

    if sheet_type == "adverb":
        return (level, word.term, word.translations, word.pattern)

    return (level, word.term, word.translations)


def write_sheet(wb: Workbook, topic: Topic, words: list[Word]) -> None:
    sheet_type = detect_sheet_type(words)
    headers = HEADERS[sheet_type]

    ws = wb.create_sheet(title=topic.name[:31])  # Excel sheet name limit

    # Header row
    ws.append(headers)
    for col, _ in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = HEADER_ALIGN

    # Data rows — sorted by knowledge_level asc, then term asc (matches app default)
    sorted_words = sorted(words, key=lambda w: (w.knowledge_level or 99, w.term.lower()))
    for word in sorted_words:
        ws.append(word_to_row(word, sheet_type))

    # Column widths
    col_widths = [12, 28, 40, 30, 60]
    for i, width in enumerate(col_widths[: len(headers)], start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = width


def export_workbook(output_path: Path) -> None:
    wb = Workbook()
    wb.remove(wb.active)  # remove default empty sheet

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
    parser = argparse.ArgumentParser(
        description="Export the Lexora database to an Excel workbook matching the original structure."
    )
    default_name = f"LexoraExport_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path(f"/tmp/{default_name}"),
        help="Output .xlsx path (default: /tmp/LexoraExport_<timestamp>.xlsx)",
    )
    args = parser.parse_args()
    export_workbook(output_path=args.output)


if __name__ == "__main__":
    main()
