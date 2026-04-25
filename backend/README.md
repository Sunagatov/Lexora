# Lexora Backend

FastAPI backend for Lexora.

## Tech stack

- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- Pydantic Settings
- pytest
- ruff

## Local Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Use example env files as templates only. Do not commit real secrets or private environment values.

## Local Checks

```bash
python -m pytest
ruff check .
```

For narrow changes, prefer the directly related pytest file first.

## AI-Agent Guidance

Read `../AGENTS.md`, `../docs/ai/request-routing-guide.md`, and `AGENTS.md` in this directory. Keep backend docs module-scoped; repo-wide AI context belongs in `../docs/ai/`.
