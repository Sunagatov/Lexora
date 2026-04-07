from __future__ import annotations

import argparse
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from sqlalchemy import select
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
    return tuple(t for v in row if (t := normalize_text(v)) is not None)


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
        raise ValueError(f"{sheet_name} row {row_number}: invalid Knowledge value '{text}'") from exc
    if not numeric.is_integer():
        raise ValueError(f"{sheet_name} row {row_number}: Knowledge must be an integer between 1 and 5")
    knowledge_level = int(numeric)
    if knowledge_level not in SUPPORTED_KNOWLEDGE_LEVELS:
        raise ValueError(f"{sheet_name} row {row_number}: Knowledge must be between 1 and 5")
    return knowledge_level


def row_to_dict(headers: tuple[str, ...], row: tuple[Any, ...]) -> dict[str, Any]:
    return {header: (row[i] if i < len(row) else None) for i, header in enumerate(headers)}


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
    raise ValueError(f"Unsupported sheet structure for '{sheet_name}'. Headers found: {headers}")


def is_effectively_empty_row(row_data: dict[str, Any], config: SheetConfig) -> bool:
    relevant = [
        config.term_header, config.translations_header, config.countability_header,
        config.pattern_header, config.example_header, config.notes_header,
        config.past_simple_header, config.past_participle_header,
    ]
    return all(normalize_text(row_data.get(h)) is None for h in relevant if h)


def is_repeated_header_row(row_data: dict[str, Any]) -> bool:
    return all(normalize_text(v) == h for h, v in row_data.items())


def get_or_create_topic(db: Session, sheet_name: str) -> tuple[Topic, bool]:
    """Return (topic, created). Matches by slug so re-runs are safe."""
    slug = slugify(sheet_name)
    topic = db.scalar(select(Topic).where(Topic.slug == slug))
    if topic:
        return topic, False
    topic = Topic(name=sheet_name, slug=slug, description=None, is_active=True)
    db.add(topic)
    db.flush()
    return topic, True


def build_existing_terms(db: Session, topic_id: int) -> set[str]:
    """Lower-cased terms already in DB for this topic."""
    rows = db.scalars(select(Word.term).where(Word.topic_id == topic_id)).all()
    return {t.lower() for t in rows}


def import_workbook(file_path: Path) -> None:
    if not file_path.exists():
        raise FileNotFoundError(f"Workbook not found: {file_path}")

    workbook = load_workbook(filename=file_path, data_only=True)

    topics_created = topics_existing = 0
    words_added = words_skipped = 0

    with SessionLocal() as db:
        try:
            for worksheet in workbook.worksheets:
                if worksheet.title in IGNORED_SHEETS:
                    continue

                header_row = tuple(cell.value for cell in next(worksheet.iter_rows(min_row=1, max_row=1)))
                headers = normalize_headers(header_row)
                config = resolve_sheet_config(worksheet.title, headers)

                topic, created = get_or_create_topic(db, worksheet.title)
                if created:
                    topics_created += 1
                else:
                    topics_existing += 1

                existing_terms = build_existing_terms(db, topic.id)

                for row_number, row in enumerate(worksheet.iter_rows(min_row=2, values_only=True), start=2):
                    row_data = row_to_dict(headers, row)

                    if is_effectively_empty_row(row_data, config):
                        continue
                    if is_repeated_header_row(row_data):
                        continue

                    term = normalize_text(row_data.get(config.term_header))
                    if term is None:
                        continue

                    # Skip if this term already exists in this topic (case-insensitive)
                    if term.lower() in existing_terms:
                        words_skipped += 1
                        continue

                    translations = normalize_text(row_data.get(config.translations_header))
                    if translations is None:
                        continue

                    word = Word(
                        topic_id=topic.id,
                        term=term,
                        translations=translations,
                        part_of_speech=config.part_of_speech,
                        knowledge_level=parse_knowledge_level(
                            row_data.get("Knowledge"),
                            sheet_name=worksheet.title,
                            row_number=row_number,
                        ),
                        past_simple=normalize_text(
                            row_data.get(config.past_simple_header) if config.past_simple_header else None
                        ),
                        past_participle=normalize_text(
                            row_data.get(config.past_participle_header) if config.past_participle_header else None
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
                    db.add(word)
                    existing_terms.add(term.lower())  # prevent duplicates within the same file
                    words_added += 1

            db.commit()
        except Exception:
            db.rollback()
            raise

    print(f"\nImport complete: {file_path}")
    print(f"  Topics  — created: {topics_created}, already existed: {topics_existing}")
    print(f"  Words   — added:   {words_added}, skipped (duplicates): {words_skipped}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync the English Vocabulary Tracker workbook into the Lexora database. "
                    "Safe to run multiple times — only new words are added, existing ones are never touched."
    )
    parser.add_argument("file", type=Path, help="Path to the .xlsx workbook")
    args = parser.parse_args()
    import_workbook(file_path=args.file)


if __name__ == "__main__":
    main()
