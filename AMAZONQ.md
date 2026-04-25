# Amazon Q Adapter For Lexora

Read `AGENTS.md` first, then route through `docs/ai/request-routing-guide.md`.

Amazon Q-specific workflow:

- Keep always-loaded context small.
- Do not duplicate current implementation state in Amazon Q rules.
- Use `docs/ai/*` for canonical repo-wide AI context.
- Use module docs only after the task is routed to backend or frontend work.

Canonical project facts live in `docs/ai/`. This file is an adapter only.
