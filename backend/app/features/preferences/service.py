from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from .model import AppPreferences
from .schemas import Preferences, PreferencesPatch


def get_preferences(db: Session) -> Preferences:
    row = db.get(AppPreferences, 1)
    return Preferences.model_validate(row.values if row else {})


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
    result = Preferences.model_validate({**values, **changes})
    row.values = result.model_dump()
    db.commit()
    return result
