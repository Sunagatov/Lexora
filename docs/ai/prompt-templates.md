# Prompt Templates

Use these prompts to keep AI-agent context narrow. They are examples, not canonical project facts.

## Backend Bug Fix

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- docs/ai/request-routing-guide.md
- backend/AGENTS.md
- <target backend files>
- directly related tests

Do not scan the whole repo.
Find the exact bug, explain root cause briefly, propose the smallest safe fix, and give regression test ideas.
```

## Frontend Bug Fix

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- docs/ai/request-routing-guide.md
- frontend/AGENTS.md
- <target frontend files>
- frontend/src/shared/http.ts only if needed

Do not scan unrelated features.
Explain the bug, propose the smallest fix, and list validation steps.
```

## Full-Stack Feature

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- docs/ai/request-routing-guide.md
- backend/AGENTS.md
- frontend/AGENTS.md
- exact backend feature files
- exact frontend feature files

Avoid unrelated folders.
Produce:
1. implementation plan
2. exact files to modify
3. API contract changes
4. regression test ideas
```

## AI Cost Optimization

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- docs/ai/request-routing-guide.md
- backend/AGENTS.md
- docs/ai/ai-cost-reduction-backlog.md
- backend/app/features/words/suggest/service.py
- directly related tests

Goal:
reduce token usage, latency, and failure rate for topic suggestion without changing user-visible behavior unless necessary.
```

## Topic Refinement / Split Planning

```text
You are working in the Lexora repo.

Read only:
- AGENTS.md
- docs/ai/request-routing-guide.md
- backend/AGENTS.md
- docs/ai/ai-curation-workflow.md
- docs/ai/topic-refinement-prompt.txt
- exact topic refinement files

Goal:
split only clearly broad topics into fewer, broader, human-readable child topics without creating near-duplicate siblings or splitting grammar buckets.
```

## Architecture Question

```text
You are working in the Lexora repo.

Use these summary files first instead of scanning source:
- docs/ai/repo-map.md
- docs/ai/architecture.md
- docs/ai/invariants.md
- docs/ai/api-surface.md

Only read source files if the summaries are not enough.
Answer using exact file paths when relevant.
```
