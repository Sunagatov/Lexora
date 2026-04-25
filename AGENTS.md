# Lexora Agent Bootloader

Lexora is a personal English vocabulary learning application. This repository owns the application source code, tests, and source-level documentation for the FastAPI backend and React frontend.

## Documentation Source-Of-Truth Policy

- `AGENTS.md` is the lightweight bootloader every AI agent should read first.
- `docs/ai/*` owns repo-wide AI-agent context and current implementation guidance.
- Module-level docs such as `backend/AGENTS.md`, `frontend/AGENTS.md`, and module READMEs own scoped module guidance only.
- `README.md` is the human-facing overview, not the detailed AI-agent encyclopedia.
- `CLAUDE.md`, `CODEX.md`, `AMAZONQ.md`, `.claude/*`, `.amazonq/*`, and `.github/copilot-instructions.md` are adapters only.
- Never copy long current-state summaries into agent-specific adapters.
- Secrets are not documentation. Do not read, print, normalize, or copy secret values.

## Hard Safety Rules

- Do not change application behavior for documentation-only tasks.
- Do not perform broad refactors unless explicitly requested.
- Do not open or print `.env`, secret, token, certificate, key, encrypted, or private config payloads.
- Do not run deployment, Docker, SSH, backup, restore, production, or secret commands from this source-repo context.
- Runtime/deployment truth belongs outside this repository. Do not move it into Lexora source docs.
- Prefer small patches and targeted validation.

## Minimal Read Order

1. Read this file.
2. Read `docs/ai/README.md`.
3. Read `docs/ai/request-routing-guide.md` to choose the smallest useful context.
4. For backend work, read `backend/AGENTS.md` and the exact feature files.
5. For frontend work, read `frontend/AGENTS.md` and the exact feature files.
6. For architecture or current-state questions, read `docs/ai/repo-map.md`, `docs/ai/architecture.md`, and `docs/ai/invariants.md`.

Stop reading once the relevant files, contracts, and validation path are known. Use `rg` or `find` before broad file reads.

## Repo Boundaries

- `backend/` contains the FastAPI backend, Alembic migrations, backend tests, and backend tooling.
- `frontend/` contains the React/Vite frontend, frontend tests, and frontend tooling.
- `docs/ai/` contains canonical repo-wide AI context.
- `docs/archive/` contains historical material that is not active agent context.
- `scripts/ai/` contains local documentation/agent helper scripts only.
- `docker-compose.yml` is local orchestration metadata; do not run Docker commands unless the user explicitly asks.

## General Agent Rules

- Keep changes focused on the requested task.
- Preserve existing backend router/service/repository boundaries unless a task explicitly changes architecture.
- Preserve frontend feature boundaries and shared HTTP behavior unless the task requires otherwise.
- Update canonical docs when behavior or project structure changes.
- Report assumptions instead of inventing facts.
