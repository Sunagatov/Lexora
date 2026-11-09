"""Read-only pronunciation coverage for non-deleted words across all libraries."""
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.features.words.model import Word


def pronunciation_coverage(db: Session) -> list[dict]:
    def present(column):
        return func.length(func.trim(func.coalesce(column, ""))) > 0

    ipa = present(Word.pronunciation_ipa)
    easy = present(Word.pronunciation_easy)
    transliteration = present(Word.transliteration)
    audio = present(Word.pronunciation_audio_url)
    counts = {
        "with_ipa": ipa,
        "with_reading_hint": easy,
        "with_transliteration": transliteration,
        "with_audio": audio,
        "missing_ipa_and_hint": ~ipa & ~easy,
        "missing_all_pronunciation": ~ipa & ~easy & ~transliteration & ~audio,
    }
    query = (
        select(Word.language, func.count().label("total"), *[
            func.sum(case((condition, 1), else_=0)).label(name)
            for name, condition in counts.items()
        ])
        .where(Word.deleted_at.is_(None))
        .group_by(Word.language)
        .order_by(Word.language)
    )
    return [dict(row) for row in db.execute(query).mappings()]
