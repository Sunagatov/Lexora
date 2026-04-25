# Codex Adapter For Lexora

Start with `AGENTS.md`, then use `docs/ai/request-routing-guide.md` to choose minimal context before broad scans.

Codex-specific workflow:

- Prefer `rg` and `find` for discovery.
- Read exact source files and nearby tests before editing.
- Use small patches and avoid unrelated formatting churn.
- Do not run destructive commands without explicit user instruction.
- Do not run deployment, Docker, SSH, backup, restore, production, or secret commands for source-doc tasks.
- Report files changed and validation commands run.

Canonical project facts live in `docs/ai/`. This file is an adapter only.
