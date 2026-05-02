# Request Routing Guide

Use this file before opening source files. The goal is to choose the smallest context that can answer or implement the task.

## Docs-Only Task

Read:

- `AGENTS.md`
- `docs/ai/README.md`
- the specific docs being changed

For agent-doc maintenance, also read:

- `CLAUDE.md`
- `CODEX.md`
- `AMAZONQ.md`
- `.claude/*`
- `.amazonq/*`
- `.github/copilot-instructions.md`
- module-level `AGENTS.md` / `CLAUDE.md`

## Backend Task

Read:

- `AGENTS.md`
- `backend/AGENTS.md`
- `docs/ai/repo-map.md`
- the target router/service/repository/schema files
- directly related backend tests

For backend structure or refactor tasks, also read:

- `docs/ai/backend-refactor-rules.md`

Only read `backend/app/shared/config.py`, `backend/app/shared/deps.py`, or `backend/app/shared/db.py` when config, auth, DB sessions, or dependencies are involved.

## Frontend Task

Read:

- `AGENTS.md`
- `frontend/AGENTS.md`
- `docs/ai/repo-map.md`
- the target page/component/hook/API files
- directly related frontend tests

Only read `frontend/src/shared/api/http.ts`, `frontend/src/app/routes.ts`, `frontend/src/app/queryKeys.ts`, or shared types when the task touches transport, navigation, contracts, or cache behavior.

For frontend structure or refactor tasks, also read:

- `docs/ai/frontend-refactor-playbook.md`

## API Contract Change

Read:

- affected backend router, schemas, service, and tests
- affected frontend API client and callers
- `docs/ai/api-surface.md`

Update API docs and tests when the contract changes. Do not scan unrelated routers.

## Test Fix

Read:

- the failing test
- the direct production code it exercises
- shared fixtures only if the failure involves setup

Avoid refactoring unrelated implementation while fixing tests.

## Architecture Question

Read:

- `docs/ai/architecture.md`
- `docs/ai/invariants.md`
- `docs/ai/repo-map.md`
- exact source files only when the docs are insufficient

## AI Curation Or Model-Cost Task

Read:

- `docs/ai/ai-curation-workflow.md` when the task is about vocabulary curation.
- `docs/ai/ai-curation.md` only for a compact schema reference.
- `docs/ai/ai-cost-reduction-backlog.md` when the task is about AI cost or prompt behavior.
- Exact backend feature files under `backend/app/features/words/` only after choosing the workflow.

Do not run live import/export scripts unless explicitly requested.

## Stop Rule

Stop reading once you know:

- the entrypoint
- the files to change
- the contract to preserve
- the smallest useful validation command

Use `rg` or `find` for discovery. Broad full-repo reading is a last resort for audits, not the default.
