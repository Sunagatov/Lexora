# Backend Agent Notes

Backend source lives in `backend/app/`. Read `AGENTS.md` and `docs/ai/request-routing-guide.md` before using this module note.

## Stack

- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic
- Pydantic 2
- pytest
- ruff

## Read Order

For backend work, start with the target feature folder and nearby tests. Only add shared files when needed:

- app wiring: `backend/app/main.py`
- config: `backend/app/shared/config.py`
- auth/dependencies: `backend/app/shared/deps.py`
- DB/session behavior: `backend/app/shared/db.py`

## Source Shape

- `backend/app/features/auth/`
- `backend/app/features/health/`
- `backend/app/features/topics/`
- `backend/app/features/words/`
- `backend/app/features/smart_review/`
- `backend/app/features/trash/`
- `backend/app/features/stats/`
- `backend/tests/`
- `backend/alembic/`

## Local Rules

- Keep router/service/repository/schema separation where the feature already uses it.
- For backend cleanup or structural work, follow `docs/ai/backend-refactor-rules.md`.
- Preserve session-cookie plus CSRF behavior for protected routers.
- Do not read or print env/secret values.
- Do not run live operational scripts unless explicitly requested.

## Validation

From `backend/`, prefer the smallest relevant pytest target first. Broader local checks are:

```bash
python -m pytest
ruff check .
```
