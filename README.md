# Lexora

Lexora is a personal English vocabulary learning application.

## Current stack

- Python 3.12+
- FastAPI
- PostgreSQL
- SQLAlchemy 2.0
- Alembic

## Current backend scope

- healthcheck endpoint
- topic CRUD
- word CRUD

## Project structure

- `backend/` — FastAPI backend
- `frontend/` — frontend placeholder
- `.env.example` — local environment template
- `docker-compose.yml` — local development stack

## Quick start

```bash
cp .env.example .env
docker compose up --build