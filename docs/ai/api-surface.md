# Confirmed API Surface

This is a concise route summary based on inspected routers. Inspect router and schema files before changing request/response contracts.

## Auth And Protection

- Public: `GET /health`, `GET /api/config/public`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`.
- API-key protected: `POST /api/words/bulk` uses `X-Api-Key`.
- Session + CSRF protected: routers mounted in `backend/app/main.py` with `verify_session` and `verify_csrf`.

Protected router groups:

- `/api/topics`
- `/api/words`
- `/api/smart-review`
- `/api/trash`
- `/api/stats`
- `/api/ai-curation`

## Auth

- `POST /auth/login` — validates password, sets `session` cookie, returns `csrf_token`.
- `POST /auth/logout` — deletes `session` cookie.
- `GET /auth/session` — validates existing session cookie and returns a CSRF token.

## Health And Public Config

- `GET /health` — service health.
- `GET /api/config/public` — public non-secret config values for frontend use.

## Topics

- `GET /api/topics` — list topics.
- `GET /api/topics/sidebar-stats` — topic sidebar stats.
- `GET /api/topics/audit` — topic refinement/audit summary.
- `GET /api/topics/{topic_id}` — get one topic.
- `POST /api/topics` — create topic.
- `PUT /api/topics/{topic_id}` — update topic.
- `POST /api/topics/{topic_id}/split-plan` — build a read-only topic split plan.
- `DELETE /api/topics/{topic_id}?delete_words={bool}` — soft-delete topic.

Obvious errors from router code include `400` for invalid topic data, `404` for missing topics, and `409` for conflicts such as duplicate names/slugs or active children.

## Words

- `GET /api/words` — list words; supports optional `topic_id` and `search`.
- `GET /api/words/export/xlsx` — export workbook.
- `POST /api/words/import/xlsx` — import workbook upload.
- `GET /api/words/export/ai-review` — export a topic page for AI review.
- `POST /api/words/import/ai-review` — import AI review payload.
- `GET /api/words/{word_id}` — get one word.
- `POST /api/words` — create word.
- `PUT /api/words/{word_id}` — update word.
- `DELETE /api/words/{word_id}` — soft-delete word.
- `POST /api/words/suggest-topic` — suggest a topic via the configured model.
- `POST /api/words/bulk` — bulk create/import words; protected by `X-Api-Key`.

Obvious errors from router code include `400` for invalid input, `404` for missing words/topics, `409` for duplicate word/topic conflicts, and model-related `5xx`/`422` errors for topic suggestion.

## Smart Review

- `GET /api/smart-review` — get or create active queue; returns `503` when disabled.
- `POST /api/smart-review/refresh` — regenerate queue; returns `503` when disabled.
- `POST /api/smart-review/items/{item_id}/complete` — complete queue item.

## AI Curation

All current curation docs should use schema `lexora.ai-curation.v2`.

- `GET /api/ai-curation/topics` — paginated topic list.
- `GET /api/ai-curation/topics/{topic_id}/words` — full paginated word export.
- `GET /api/ai-curation/topics/{topic_id}/export` — full or lean export.
- `POST /api/ai-curation/import` — dry-run or apply v2 curation payload.

Export query params include `lean`, `needs_examples_only`, `page`, and `page_size`.

## Trash

- `GET /api/trash/words` — list deleted words.
- `GET /api/trash/topics` — list deleted topics.
- `POST /api/trash/words/{word_id}/restore` — restore deleted word.
- `POST /api/trash/topics/{topic_id}/restore` — restore deleted topic.
- `DELETE /api/trash/purge?force={bool}` — hard-delete expired trash, or all trash with force.

## Stats

- `GET /api/stats` — aggregate stats.
- `POST /api/stats/usage` — record usage event.

## Mounted Routers

Confirmed in `backend/app/main.py`:

- `health`
- `auth`
- `words_agent_router`
- `topics`
- `words`
- `words/suggest`
- `smart_review`
- `trash`
- `stats`
- `words/ai_curation`
