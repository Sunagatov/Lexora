# Copilot instructions for Lexora

Lexora is a compact monorepo with:

- FastAPI backend in `backend/`
- React + TypeScript frontend in `frontend/`
- Docker Compose at repo root

## How to work efficiently

- Read the nearest `AGENTS.md` first.
- Prefer scoped changes over repository-wide refactors.
- Do not bypass the shared frontend request helper in `frontend/src/shared/http.ts` unless the task requires a new transport pattern.
- Preserve backend auth rules based on cookie session + CSRF header.
- Use existing feature boundaries instead of introducing new abstractions too early.

## Backend conventions

- Keep router/service/repository separation.
- Preserve current HTTP status semantics.
- Keep business rules in service/repository layers rather than routers.
- Reuse `app.shared.config` and `app.shared.deps` for config/auth/db access.

## Frontend conventions

- Prefer feature-local components and hooks.
- Use React Query for server-state concerns where existing code already does.
- Keep route changes aligned with `frontend/src/app/router.tsx`.
- Preserve UX behavior around study flow, smart review, trash, and stats.

## Token-saving rule

For code generation, inspect only the touched feature folder plus directly relevant shared files.
Additional context lives in `docs/ai/`.
