# Context budget rules

These rules are designed to reduce token spend for coding assistants.

## Default budget mindset

Treat repository context as expensive.

Prefer:
- one agent file
- a handful of source files
- one compact architecture note

Avoid:
- re-reading large files already summarised in `docs/ai/`
- opening unrelated feature folders
- restating the whole repo in every session

## Recommended read order

### Backend task
1. `AGENTS.md`
2. `backend/AGENTS.md`
3. target router/service/repository/schema files
4. shared config/deps only if needed

### Frontend task
1. `AGENTS.md`
2. `frontend/AGENTS.md`
3. target page/component/hook/API files
4. shared HTTP/routes/types only if needed

### AI optimisation task
1. `AGENTS.md`
2. `backend/AGENTS.md`
3. `docs/ai/ai-cost-reduction-backlog.md`
4. `backend/app/features/words/suggest_service.py`

## Stop conditions

Do not load more files once you know:

- the exact entry point
- the exact files to change
- the contract that must remain stable
- the minimal validation needed

## Compression strategy

Before opening more code, prefer these summary docs:

- `docs/ai/repo-map.md`
- `docs/ai/architecture.md`
- `docs/ai/api-surface.md`
- `docs/ai/env-reference.md`

## Editing strategy

- modify as few files as possible
- avoid pure stylistic edits during bug fixes
- avoid broad renames unless they solve a real problem
- do not reformat unrelated files

## Testing strategy

- run targeted tests first
- run broader suites only when the changed contract is wide
- avoid repo-wide scans for a small change

## Anti-patterns

- “Read everything first”
- “Refactor while I am here”
- “Open both frontend and backend for a tiny UI text fix”
- “Load all routers to answer one endpoint question”
