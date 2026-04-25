# AI Curation Reference

`docs/ai/ai-curation-workflow.md` is the canonical current workflow.

Current backend schema:

- `schema_version`: `lexora.ai-curation.v2`
- source: `backend/app/features/words/ai_curation/schemas.py`
- import endpoint: `POST /api/ai-curation/import`
- auth: session cookie + `X-CSRF-Token`

Current v2 import arrays:

- `topic_operations` creates topics that can be referenced by `client_key`.
- `word_updates` sparsely updates existing words.
- `word_creates` creates new words and assigns them to topics.
- `word_reassigns` changes topic membership for existing words.

Legacy compatibility:

- `word_operations` is accepted by the backend only as a backward-compatibility input.
- Legacy operation names such as `create_new_word`, `update_existing_word`, and `reassign_word_topics` are translated into the v2 arrays.
- Do not use the legacy shape for new docs, prompts, or examples.

Inspect `docs/ai/ai-curation-workflow.md` and the schema/router files before changing this contract.
