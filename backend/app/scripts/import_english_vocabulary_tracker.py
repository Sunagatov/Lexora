from __future__ import annotations

import argparse
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.topic import Topic
from app.models.word import Word

IGNORED_SHEETS = {"Lists", "Start Here"}

VERB_HEADERS = (
    "Knowledge",
    "Word",
    "Russian translations",
    "Typical prepositions / patterns",
    "Examples (EN + RU)",
)
NOUN_HEADERS = (
    "Knowledge",
    "Word",
    "Russian translations",
    "Countability",
)
PHRASE_HEADERS = (
    "Knowledge",
    "Phrase",
    "Russian translations",
    "Meaning / usage note",
)
PLAIN_WORD_HEADERS = (
    "Knowledge",
    "Word",
    "Russian translations",
)
IRREGULAR_VERB_HEADERS = (
    "Knowledge",
    "Base form",
    "Past Simple",
    "Past Participle",
    "Russian translations",
    "Typical prepositions / patterns",
    "Examples (EN + RU)",
)
ADVERB_HEADERS = (
    "Knowledge",
    "Word",
    "Russian translations",
    "Typical position / usage",
)

SUPPORTED_KNOWLEDGE_LEVELS = {1, 2, 3, 4, 5}


@dataclass(frozen=True)
class SheetConfig:
    part_of_speech: str
    term_header: str
    translations_header: str
    countability_header: str | None = None
    pattern_header: str | None = None
    example_header: str | None = None
    notes_header: str | None = None
    past_simple_header: str | None = None
    past_participle_header: str | None = None


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def normalize_headers(row: tuple[Any, ...]) -> tuple[str, ...]:
    headers: list[str] = []
    for value in row:
        text = normalize_text(value)
        if text is not None:
            headers.append(text)
    return tuple(headers)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()

    if not slug:
        raise ValueError(f"Cannot build slug from sheet name: {value}")

    return slug[:200]


def parse_knowledge_level(value: Any, *, sheet_name: str, row_number: int) -> int:
    text = normalize_text(value)
    if text is None:
        raise ValueError(f"{sheet_name} row {row_number}: Knowledge is required")

    try:
        numeric = float(text)
    except ValueError as exc:
        raise ValueError(
            f"{sheet_name} row {row_number}: invalid Knowledge value '{text}'"
        ) from exc

    if not numeric.is_integer():
        raise ValueError(
            f"{sheet_name} row {row_number}: Knowledge must be an integer between 1 and 5"
        )

    knowledge_level = int(numeric)
    if knowledge_level not in SUPPORTED_KNOWLEDGE_LEVELS:
        raise ValueError(
            f"{sheet_name} row {row_number}: Knowledge must be between 1 and 5"
        )

    return knowledge_level


def row_to_dict(headers: tuple[str, ...], row: tuple[Any, ...]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for index, header in enumerate(headers):
        result[header] = row[index] if index < len(row) else None
    return result


def resolve_sheet_config(sheet_name: str, headers: tuple[str, ...]) -> SheetConfig:
    if headers == VERB_HEADERS:
        return SheetConfig(
            part_of_speech="verb",
            term_header="Word",
            translations_header="Russian translations",
            pattern_header="Typical prepositions / patterns",
            example_header="Examples (EN + RU)",
        )

    if headers == NOUN_HEADERS:
        return SheetConfig(
            part_of_speech="noun",
            term_header="Word",
            translations_header="Russian translations",
            countability_header="Countability",
        )

    if headers == PHRASE_HEADERS:
        return SheetConfig(
            part_of_speech="phrase",
            term_header="Phrase",
            translations_header="Russian translations",
            notes_header="Meaning / usage note",
        )

    if headers == PLAIN_WORD_HEADERS:
        part_of_speech = "preposition" if sheet_name == "Prepositions" else "adjective"
        return SheetConfig(
            part_of_speech=part_of_speech,
            term_header="Word",
            translations_header="Russian translations",
        )

    if headers == IRREGULAR_VERB_HEADERS:
        return SheetConfig(
            part_of_speech="verb",
            term_header="Base form",
            translations_header="Russian translations",
            pattern_header="Typical prepositions / patterns",
            example_header="Examples (EN + RU)",
            past_simple_header="Past Simple",
            past_participle_header="Past Participle",
        )

    if headers == ADVERB_HEADERS:
        return SheetConfig(
            part_of_speech="adverb",
            term_header="Word",
            translations_header="Russian translations",
            pattern_header="Typical position / usage",
        )

    raise ValueError(
        f"Unsupported sheet structure for '{sheet_name}'. Headers found: {headers}"
    )


def is_effectively_empty_row(row_data: dict[str, Any], config: SheetConfig) -> bool:
    relevant_headers = [
        config.term_header,
        config.translations_header,
        config.countability_header,
        config.pattern_header,
        config.example_header,
        config.notes_header,
        config.past_simple_header,
        config.past_participle_header,
    ]
    return all(normalize_text(row_data.get(header)) is None for header in relevant_headers if header)


def is_repeated_header_row(row_data: dict[str, Any]) -> bool:
    return all(normalize_text(value) == header for header, value in row_data.items())


def ensure_database_is_empty(db: Session) -> None:
    topic_count = db.scalar(select(func.count(Topic.id))) or 0
    word_count = db.scalar(select(func.count(Word.id))) or 0

    if topic_count > 0 or word_count > 0:
        raise ValueError(
            "Database already contains vocabulary data. "
            "Run the importer with --truncate-first to replace it safely."
        )


def create_topic(db: Session, sheet_name: str) -> Topic:
    topic = Topic(
        name=sheet_name,
        slug=slugify(sheet_name),
        description=None,
        is_active=True,
    )
    db.add(topic)
    db.flush()
    return topic


def create_word(
    *,
    topic_id: int,
    config: SheetConfig,
    row_data: dict[str, Any],
    sheet_name: str,
    row_number: int,
) -> Word:
    term = normalize_text(row_data.get(config.term_header))
    translations = normalize_text(row_data.get(config.translations_header))

    if term is None:
        raise ValueError(f"{sheet_name} row {row_number}: term is required")

    if translations is None:
        raise ValueError(f"{sheet_name} row {row_number}: Russian translations are required")

    return Word(
        topic_id=topic_id,
        term=term,
        past_simple=normalize_text(
            row_data.get(config.past_simple_header) if config.past_simple_header else None
        ),
        past_participle=normalize_text(
            row_data.get(config.past_participle_header) if config.past_participle_header else None
        ),
        translations=translations,
        part_of_speech=config.part_of_speech,
        knowledge_level=parse_knowledge_level(
            row_data.get("Knowledge"),
            sheet_name=sheet_name,
            row_number=row_number,
        ),
        countability=normalize_text(
            row_data.get(config.countability_header) if config.countability_header else None
        ),
        pattern=normalize_text(
            row_data.get(config.pattern_header) if config.pattern_header else None
        ),
        example=normalize_text(
            row_data.get(config.example_header) if config.example_header else None
        ),
        notes=normalize_text(
            row_data.get(config.notes_header) if config.notes_header else None
        ),
        is_active=True,
    )


def import_workbook(file_path: Path, truncate_first: bool) -> None:
    if not file_path.exists():
        raise FileNotFoundError(f"Workbook not found: {file_path}")

    workbook = load_workbook(filename=file_path, data_only=True)

    imported_topics = 0
    imported_words = 0

    with SessionLocal() as db:
        try:
            if truncate_first:
                db.execute(delete(Word))
                db.execute(delete(Topic))
                db.flush()
            else:
                ensure_database_is_empty(db)

            for worksheet in workbook.worksheets:
                if worksheet.title in IGNORED_SHEETS:
                    continue

                header_row = tuple(cell.value for cell in next(worksheet.iter_rows(min_row=1, max_row=1)))
                headers = normalize_headers(header_row)
                config = resolve_sheet_config(worksheet.title, headers)

                topic = create_topic(db, worksheet.title)
                imported_topics += 1

                for row_number, row in enumerate(worksheet.iter_rows(min_row=2, values_only=True), start=2):
                    row_data = row_to_dict(headers, row)

                    if is_effectively_empty_row(row_data, config):
                        continue

                    if is_repeated_header_row(row_data):
                        continue

                    word = create_word(
                        topic_id=topic.id,
                        config=config,
                        row_data=row_data,
                        sheet_name=worksheet.title,
                        row_number=row_number,
                    )
                    db.add(word)
                    imported_words += 1

            db.commit()
        except Exception:
            db.rollback()
            raise

    print(f"Workbook imported successfully: {file_path}")
    print(f"Topics imported: {imported_topics}")
    print(f"Words imported: {imported_words}")
    print(f"Ignored helper sheets: {', '.join(sorted(IGNORED_SHEETS))}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import the English Vocabulary Tracker workbook into the Lexora database"
    )
    parser.add_argument("file", type=Path, help="Path to the .xlsx workbook")
    parser.add_argument(
        "--truncate-first",
        action="store_true",
        help="Delete existing topics and words before importing the workbook",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    import_workbook(file_path=args.file, truncate_first=args.truncate_first)


if __name__ == "__main__":
    main()