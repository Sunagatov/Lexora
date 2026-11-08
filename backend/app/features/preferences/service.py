from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.shared.config import settings

from .model import AppPreferences
from .schemas import Preferences, PreferencesPatch, WordMixPreferences


def default_word_mix_preferences() -> WordMixPreferences:
    # Display the existing server defaults until the owner customises their mix.
    weights = {1: settings.smart_review_weak, 3: settings.smart_review_basic + settings.smart_review_okay,
               4: settings.smart_review_strong, 5: settings.smart_review_mastered}
    return WordMixPreferences(size=settings.smart_review_queue_size, levels=[level for level, weight in weights.items() if weight > 0] or [1],
                              cooldown_days=settings.smart_review_cooldown_days)


def configured_word_mix_preferences(db: Session) -> WordMixPreferences | None:
    row = db.get(AppPreferences, 1)
    values = row.values.get("word_mix") if row else None
    return WordMixPreferences.model_validate(values) if values is not None else None


def get_preferences(db: Session) -> Preferences:
    row = db.get(AppPreferences, 1)
    result = Preferences.model_validate(row.values if row else {})
    if result.word_mix is None:
        result.word_mix = default_word_mix_preferences()
    return result


def update_preferences(db: Session, patch: PreferencesPatch) -> Preferences:
    # Seed once, then serialize partial updates so two devices changing unrelated
    # settings cannot overwrite one another's preferences.
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    db.execute(
        insert(AppPreferences).values(id=1, values={}).on_conflict_do_nothing(index_elements=["id"])
    )
    row = db.scalar(
        select(AppPreferences)
        .where(AppPreferences.id == 1)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    values = dict(row.values)
    changes = patch.model_dump(exclude_unset=True)
    if "pronunciation_modes" in changes:
        changes["pronunciation_modes"] = {
            **values.get("pronunciation_modes", {}),
            **changes["pronunciation_modes"],
        }
    if "word_mix" in changes:
        changes["word_mix"] = {
            **(values.get("word_mix") or default_word_mix_preferences().model_dump()),
            **changes["word_mix"],
        }
    result = Preferences.model_validate({**values, **changes})
    row.values = result.model_dump()
    db.commit()
    return get_preferences(db)
