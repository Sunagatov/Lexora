Read first:

- `AGENTS.md`
- `docs/ai/request-routing-guide.md`
- `docs/ai/ai-curation-workflow.md`
- `docs/ai/chatgpt-enrich-examples-prompt.txt`
- `docs/ai/example-style-guide.md`
- `backend/AGENTS.md`

Use this command template only when the user explicitly asks for topic enrichment work. Do not run live import/export scripts unless explicitly requested.

Inputs:

- topic_id:
- topic_name:
- start_page:
- export file:
- known blockers:

Output:

- brief per-page status
- which pages were already complete
- which pages were completed now
- remaining pages, if any
