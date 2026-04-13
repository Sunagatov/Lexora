from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.stats.model import WordProgressEvent


def record_level_change(
    db: Session,
    word_id: int,
    old_level: int | None,
    new_level: int,
    source: str,
) -> None:
    """Append a progress event. Does not commit — caller owns the transaction."""
    db.add(WordProgressEvent(
        word_id=word_id,
        old_level=old_level,
        new_level=new_level,
        source=source,
    ))
