# Claude / Cloudy CLI entrypoint for Lexora

Start with `AGENTS.md`.

Then load only the smallest relevant context:

- backend task -> `backend/AGENTS.md`
- frontend task -> `frontend/AGENTS.md`
- architecture question -> `docs/ai/architecture.md`
- API question -> `docs/ai/api-surface.md`
- token/cost optimisation -> `docs/ai/ai-cost-reduction-backlog.md`
- prompt hygiene / context budgeting -> `docs/ai/context-budget-rules.md`

## Hard rule

Do not read the whole repository by default.

For most tasks, read:

- one agent file
- the directly affected feature files
- at most 1–3 shared helper files

## Output preference

Prefer:

- exact file paths
- focused diffs
- regression test ideas
- short explanation of why the change is needed

Avoid:

- repeating repository-wide summaries in every answer
- proposing large refactors without evidence
- touching auth/CSRF plumbing unless required
