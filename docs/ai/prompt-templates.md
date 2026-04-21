# Prompt templates for Claude / Cloudy / Copilot Chat

Use these prompts to keep context narrow.

## 1. Backend bug fix

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- backend/AGENTS.md
- <target backend files>

Do not scan the whole repo.
Find the exact bug, explain root cause briefly, propose the smallest safe fix, and give regression test ideas.
```

## 2. Frontend bug fix

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- frontend/AGENTS.md
- <target frontend files>
- frontend/src/shared/http.ts only if needed

Do not scan unrelated features.
Explain the bug, propose the smallest fix, and list validation steps.
```

## 3. Full-stack feature

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- backend/AGENTS.md
- frontend/AGENTS.md
- the exact backend feature files for this change
- the exact frontend feature files for this change

Avoid unrelated folders.
Produce:
1. implementation plan
2. exact files to modify
3. API contract changes
4. regression test ideas
```

## 4. AI cost optimisation

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- backend/AGENTS.md
- docs/ai/ai-cost-reduction-backlog.md
- backend/app/features/words/suggest_service.py
- any directly related tests

Goal:
reduce token usage, latency, and failure rate for topic suggestion without changing user-visible behaviour unless necessary.

Prioritise:
- deterministic shortcuts
- candidate shortlisting
- caching
- smaller prompts
- smaller max_tokens
- measurement
- use stable repo docs first so the model does not re-derive known invariants

## 6. Topic refinement / split planning

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- backend/AGENTS.md
- docs/ai/ai-curation-workflow.md
- docs/ai/topic-refinement-prompt.txt
- the exact topic refinement files you need

Goal:
split only clearly broad topics into fewer, broader, human-readable child topics
without creating near-duplicate siblings or splitting grammar buckets.

Prioritise:
- prod-only exports
- dry-run first
- reuse existing topics when they already fit
- keep umbrella topics in place
- parent_topic_id for hierarchy
- many-to-many word membership
- spot-check large plans before live import
- under-split rather than over-split when the topic family is mixed
- avoid near-duplicate sibling names and fuzzy boundaries
```
```

## 5. Architecture question

```text
You are working in the Lexora repo.

Use these summary files first instead of scanning source:
- docs/ai/repo-map.md
- docs/ai/architecture.md
- docs/ai/api-surface.md

Only read source files if the summaries are not enough.
Answer using exact file paths when relevant.
```
