# Lexora AI Documentation Index

`docs/ai/` is the canonical repo-wide knowledge base for AI agents working in Lexora. Keep it concise, factual, and source-backed.

## Canonical Files

- `README.md` owns this index and the documentation maintenance rules.
- `request-routing-guide.md` tells agents what to read for each task type.
- `repo-map.md` maps current repository structure and active source areas.
- `invariants.md` captures hard rules that should not be violated without explicit instruction.
- `token-budget-rules.md` defines context-minimisation rules for agents.
- `architecture.md` summarizes application flow at a high level.
- `api-surface.md` summarizes confirmed API routes; inspect routers before changing contracts.
- `env-reference.md` lists configuration names and themes without secret values.
- `development-workflow.md` summarizes safe local validation commands.

Specialized AI/product docs:

- `ai-curation.md`, `ai-curation-workflow.md`, `example-style-guide.md`, and prompt `.txt` files support vocabulary curation workflows.
- `ai-cost-reduction-backlog.md` tracks model-cost reduction ideas.

## Adapter Files

These files are entrypoints only and must stay thin:

- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `AMAZONQ.md`
- `.claude/*`
- `.amazonq/*`
- `.github/copilot-instructions.md`
- module-level `AGENTS.md` / `CLAUDE.md`

Adapters may duplicate only bootstrapping rules, safety rules, and links to canonical docs. Do not copy long current-state summaries into adapters.

## Read-On-Demand Discipline

Start with `AGENTS.md`, this index, and `request-routing-guide.md`. Then read only the module docs and source files required by the task.

Do not read archive files, generated-looking duplicates, secret files, or unrelated modules as active context.

## Updating Docs

- When source structure changes, update `repo-map.md`.
- When API contracts change, update `api-surface.md` and tests.
- When safety rules or architectural constraints change, update `invariants.md`.
- When routing guidance changes, update `request-routing-guide.md` and keep adapters pointing to it.
- Module-level docs should stay module-specific and must not duplicate repo-wide AI policy.

Historical records belong under `docs/archive/`, which is not active agent context.
