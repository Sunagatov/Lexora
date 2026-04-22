# Lexora — Agent Instructions

This repository is a monorepo for **Lexora**, a personal English vocabulary learning app.

## Stack at a glance

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, psycopg 3, Alembic, Pydantic 2, httpx
- **Frontend:** React 19, TypeScript 5, Vite 6, React Router 6, React Query 5, Vitest
- **Infra:** Docker Compose with Postgres 16, backend on `:8000`, frontend on `:5173`

## Read order for low-token work

1. Read this file.
2. Read `.claude/generated/request-routing.md` if it exists.
3. Read the nearest scoped file:
   - `backend/AGENTS.md` for backend changes
   - `frontend/AGENTS.md` for frontend changes
   - `docs/ai/ai-curation-workflow.md` for enriching topic words via ChatGPT + REST API
4. Read only the files directly touched by the task.
5. Read supporting shared files only if required:
   - backend: `backend/app/shared/config.py`, `backend/app/shared/deps.py`
   - frontend: `frontend/src/shared/http.ts`, `frontend/src/shared/routes.ts`, shared types used by the target feature

Do **not** scan the whole repo unless the task explicitly requires a full audit.

## Repo shape

- `backend/` — FastAPI app, feature folders, DB logic, auth, smart review
- `frontend/` — React app, router, feature screens, shared HTTP client
- `docker-compose.yml` — local orchestration for DB + backend + frontend
- `docs/ai/` — compact project context for coding assistants

## Vault and prod access

- When a task touches prod data, use the Vault-managed app checkout and secrets, not repo-local `.env` files.
- For Lexora prod API work, the backend secret source is usually `/Users/zufar/IdeaProjects/Vault/scripts/secrets/view.sh lexora-backend .env.prod`.
- For live authenticated API calls, log in with `/auth/login`, capture the returned `csrf_token`, and reuse the session cookie plus `X-CSRF-Token` header for protected routes.
- For topic cleanup, prefer reading `/api/topics/audit` and `/api/topics` first, then rename or split from concrete data instead of guessing names.
- For prod writes, keep changes small and reversible: rename in place when IDs must stay stable; split only when the topic family is genuinely broad and cleanly separable.

## Important invariants

- Authenticated backend routes rely on **session cookie + CSRF header**.
- Frontend API calls should normally go through `frontend/src/shared/http.ts`.
- Preserve current route structure unless the task explicitly changes navigation.
- Prefer **minimal diffs** over broad refactors.
- Keep backend changes aligned with existing router/service/repository separation.
- Keep frontend changes feature-local when possible.

## AI-specific guidance

Lexora already has one AI-assisted path: topic suggestion for words. Before adding or changing model calls:

- prefer deterministic logic first
- shortlist candidates before calling a model
- keep prompts compact
- keep `max_tokens` tight
- cache repeat lookups
- log latency and failure modes

For topic-enrichment work, prefer the workflow documented in `docs/ai/ai-curation-workflow.md` and `docs/ai/topic-refinement-prompt.txt`:

- export from prod only
- use lean export when possible
- treat 3 strong example sentences as the default "complete" threshold
- for broad topics, split by safe reassignment first instead of deleting the umbrella topic
- dry-run before any live import
- keep the topic split plan explainable and human-reviewable
- create new topics first, then reassign words in batches
- avoid deterministic filler generators for example sentences unless explicitly requested

See `docs/ai/ai-cost-reduction-backlog.md` before modifying the suggestion flow.

## Validation rule

When you change code, run the smallest relevant validation first:

- backend-only: targeted pytest and lint
- frontend-only: targeted vitest / build / lint
- full-stack: validate both sides, but still avoid unrelated suites
