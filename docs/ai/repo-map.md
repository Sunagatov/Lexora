# Lexora Repo Map

This is a compact working map, not a full file listing. Verify exact files with `find` or `rg` before editing.

## Root

- `README.md` — human-facing project overview and local start notes.
- `AGENTS.md` — canonical AI bootloader.
- `CLAUDE.md`, `CODEX.md`, `AMAZONQ.md` — thin agent adapters.
- `.claude/`, `.amazonq/`, `.github/copilot-instructions.md` — tool-specific adapters only.
- `docker-compose.yml` — local orchestration metadata.
- `scripts/ai/` — local agent/doc helper scripts.
- `docs/ai/` — canonical repo-wide AI context.
- `docs/archive/` — historical docs; not active guidance.

## Backend

Backend source lives in `backend/app/`.

- `backend/app/main.py` wires FastAPI, middleware, lifespan, and routers.
- `backend/app/shared/` contains config, DB/session helpers, auth dependencies, constraints, and text helpers.
- `backend/alembic/` contains migrations.
- `backend/tests/` contains pytest coverage.
- `backend/pyproject.toml` defines backend dependencies and ruff settings.
- `backend/pytest.ini` configures tests.

Active backend feature areas:

- `backend/app/features/auth/`
- `backend/app/features/health/`
- `backend/app/features/topics/`
- `backend/app/features/words/`
- `backend/app/features/words/suggest/`
- `backend/app/features/words/ai_curation/`
- `backend/app/features/words/ai_review/`
- `backend/app/features/words/bulk/`
- `backend/app/features/words/workbook/`
- `backend/app/features/smart_review/`
- `backend/app/features/trash/`
- `backend/app/features/stats/`

Backend feature note:

- Some features expose a small `api.py` module for stable cross-feature access.
- Prefer those feature APIs over importing another feature's repository or domain internals directly.
- `backend/app/features/topics/refinement_*.py` keeps topic audit/planning heuristics split from the façade service.
- `backend/app/features/stats/service.py` orchestrates metrics while `activity_metrics.py` and `content_metrics.py` hold pure calculations.

Backend scripts live in `backend/app/scripts/`. Treat scripts that call live services as operational tools; do not run them unless explicitly requested.

## Frontend

Frontend source lives in `frontend/src/`.

- `frontend/src/main.tsx` bootstraps React.
- `frontend/src/app/providers.tsx` wires providers.
- `frontend/src/app/router.tsx` owns the route table.
- `frontend/src/app/layout/` contains application layout.
- `frontend/src/shared/` contains shared HTTP helpers, config, hooks, UI primitives, and utilities.
- `frontend/src/styles/` contains CSS split by UI area.
- `frontend/src/test/` contains test setup.
- `frontend/package.json` defines frontend scripts and dependencies.

Active frontend feature areas:

- `frontend/src/features/auth/`
- `frontend/src/features/study/`
- `frontend/src/features/topics/`
- `frontend/src/features/words/`
- `frontend/src/features/smart-review/`
- `frontend/src/features/trash/`
- `frontend/src/features/stats/`

## Tests

- Backend tests: `backend/tests/`.
- Frontend tests: colocated `*.test.tsx` files and `frontend/src/**/__tests__/`.
- Prefer targeted tests for the feature being changed before broader validation.

## Configuration

- Backend config names are documented in `docs/ai/env-reference.md` and defined in `backend/app/shared/config.py`.
- Frontend runtime build variables are represented in Vite config and frontend env typings.
- Do not open or print local `.env` files or secret payloads.

## Archive And Generated-Looking Areas

- `docs/archive/` is historical only.
- `.claude/generated/request-routing.md` is a compatibility pointer, not generated source-of-truth.
- Do not treat archived or generated-looking files as active guidance when canonical docs exist.
