# Copilot Adapter For Lexora

Read `AGENTS.md` first, then use `docs/ai/request-routing-guide.md`.

This file is an adapter only. Canonical project facts live in `docs/ai/*`.

Copilot workflow:

- Prefer scoped changes over repository-wide refactors.
- Inspect only the touched feature folder plus directly relevant shared files.
- Preserve shared frontend HTTP behavior and backend session/CSRF rules.
- Do not read or print secret values.
