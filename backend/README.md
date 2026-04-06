# Lexora

Starter monorepo for a personal English vocabulary learning application.

## Current scope

- Python backend with FastAPI
- PostgreSQL database
- SQLAlchemy 2.0 ORM
- Alembic migrations
- Topic CRUD
- Word CRUD
- Healthcheck endpoint

## Planned next steps

- review sessions
- flashcard / quiz APIs
- spaced repetition logic
- frontend UI

## Structure

- `backend/` — FastAPI backend
- `frontend/` — frontend placeholder
- `.env.example` — local environment template
- `docker-compose.yml` — local development stack

## Quick start

```bash
cp .env.example .env
docker compose up --build