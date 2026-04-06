# Backend

FastAPI backend for the English Learning App.

## Local run without Docker

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp ../.env.example .env
alembic upgrade head
uvicorn app.main:app --reload