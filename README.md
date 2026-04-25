# Lexora

Lexora is a personal English vocabulary learning app focused on topic-based study, review, word management, and progress tracking.

## Project Shape

- `backend/` — FastAPI backend, Alembic migrations, and pytest tests.
- `frontend/` — React/Vite frontend and Vitest tests.
- `docs/ai/` — canonical AI-agent context and source-level project maps.
- `scripts/ai/` — local AI documentation helper scripts.

## Quick Start

Prerequisites:

- Docker Desktop for the compose-based local stack.
- Node.js 20+ and npm for frontend work outside Docker.
- Python 3.12+ for backend work outside Docker.

Local environment files are intentionally not documentation. Use the example env files as templates and do not commit secret values.

```bash
cp .env.example .env
```

Local compose metadata is in `docker-compose.yml`. Run Docker only when you explicitly intend to start the local stack.

## Developer Docs

- Backend notes: `backend/README.md`
- Frontend notes: `frontend/README.md`
- AI-agent bootloader: `AGENTS.md`
- AI-agent docs index: `docs/ai/README.md`
- Current repo map for agents: `docs/ai/repo-map.md`

Detailed current implementation state for AI agents lives in `docs/ai/`, not in this README.
