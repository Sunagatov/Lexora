# Lexora Backend

FastAPI backend for Lexora.

## Tech stack

- FastAPI
- SQLAlchemy 2.0
- Alembic
- PostgreSQL
- Pydantic Settings

## Local run without Docker

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000