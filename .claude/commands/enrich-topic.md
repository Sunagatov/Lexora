Work in `/Users/zufar/PycharmProjects/Lexora`.

Goal:
Enrich topic `<topic_id>` on prod with exactly 3 natural English example sentences per word, page by page.

Read first:
- `AGENTS.md`
- `.claude/generated/request-routing.md`
- `docs/ai/ai-curation-workflow.md`
- `docs/ai/chatgpt-enrich-examples-prompt.txt`
- `docs/ai/example-style-guide.md`
- `backend/AGENTS.md`

Rules:
- Export from prod only.
- Use the lean export endpoint.
- Work page by page and verify each page before moving on.
- Use model-written examples only.
- Do not use deterministic template generators unless explicitly requested.
- Keep any dry-run, live import, and verification artifacts under `backend/.artifacts/ai-curation/topic-<topic_id>/`.
- If a page is already complete, skip it.

Inputs:
- topic_id:
- topic_name:
- start_page:
- prod export file:
- known blockers:

Output:
- brief per-page status
- which pages were already complete
- which pages were completed now
- remaining pages, if any
