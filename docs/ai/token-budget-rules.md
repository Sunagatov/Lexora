# Token Budget Rules

Treat repository context as expensive.

## Source Selection

- Do not load `CLAUDE.md`, `CODEX.md`, `AMAZONQ.md`, `.claude/*`, or `.amazonq/*` for project facts. They are adapters only.
- Use `docs/ai/request-routing-guide.md` to choose minimal context.
- Use `docs/ai/repo-map.md` for structure before reading source trees.
- Do not read `docs/archive/` as active context unless the user explicitly asks for history.
- Do not read generated-looking duplicates as source-of-truth when canonical docs exist.

## Safety

- Do not read, print, summarize, or normalize secret values.
- Avoid `.env`, `.env.*`, key, cert, token, encrypted, and private config payloads.
- Report assumptions instead of guessing when facts are not available from safe files.

## Reading Strategy

- Prefer `rg` and `find` over broad full-file reading.
- Read directly affected files and nearby tests first.
- Stop reading once exact files and contracts are known.
- Avoid opening unrelated backend/frontend modules for narrow fixes.

## Editing Strategy

- Prefer small focused edits.
- Avoid unrelated formatting churn.
- Do not add dependencies unless the task clearly requires them.
- Keep module-level docs scoped to module facts.
- Update canonical docs rather than duplicating current-state summaries in adapters.
