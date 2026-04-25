# Claude CLI Adapter For Lexora

@AGENTS.md

Claude-specific workflow:

- Treat `AGENTS.md` as the bootloader and `docs/ai/*` as canonical project context.
- Use `docs/ai/request-routing-guide.md` before opening source files.
- Load only the relevant module adapter (`backend/AGENTS.md` or `frontend/AGENTS.md`) after routing.
- Keep `.claude/*` guidance small; do not duplicate current implementation state there.
- Prefer focused diffs, exact file paths, and a short validation summary.

Canonical details live in `docs/ai/`. This file is an adapter only.
