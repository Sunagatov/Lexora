# Confirmed API surface

This file lists **confirmed** routes based on inspected code. It is intentionally incomplete rather than speculative.

## Auth

### `POST /auth/login`
- request: password payload
- success: returns `{ ok: true, csrf_token: string }`
- side effect: sets `session` cookie

### `POST /auth/logout`
- success: returns `{ ok: true }`
- side effect: deletes `session` cookie

## Topics

### `GET /api/topics`
Returns all topics.

### `GET /api/topics/{topic_id}`
Returns one topic or `404`.

### `POST /api/topics`
Creates a topic.
Known errors:
- `400` invalid topic name
- `409` slug conflict

### `PUT /api/topics/{topic_id}`
Updates a topic.
Known errors:
- `404` topic not found
- `400` invalid topic name
- `409` slug conflict

### `DELETE /api/topics/{topic_id}?delete_words={bool}`
Soft-deletes a topic.

## Words

### `GET /api/words`
Query params:
- `topic_id` (optional, positive int)
- `search` (optional, min length 1)

### `GET /api/words/{word_id}`
Returns one word or `404`.

### `POST /api/words`
Creates a word.
Known errors:
- `400` missing topics
- `409` duplicate word in topic

### `PUT /api/words/{word_id}`
Updates a word.
Known errors:
- `404` word not found
- `400` missing topics
- `409` duplicate word in topic

### `DELETE /api/words/{word_id}`
Soft-deletes a word.

### `POST /api/words/bulk`
Bulk create/import words.
Protected by `X-Api-Key`.
Known errors:
- `400` invalid topic name for slug generation
- `409` topic exists in trash
- `409` slug conflict

### `POST /api/words/suggest-topic`
Given a word and translation, returns a suggested topic.
Known errors include:
- `503` AI not configured
- `404` no topics found
- `422` AI returned unknown topic
- `504` AI timeout
- `502` upstream AI HTTP / connection failures

## Smart review

### `GET /api/smart-review`
Returns active queue or `503` when disabled.

### `POST /api/smart-review/refresh`
Regenerates queue or `503` when disabled.

### `POST /api/smart-review/items/{item_id}/complete`
Completes a queue item.
Known errors:
- `404` queue item not found
- `404` queue inactive / missing

## AI curation

### `GET /api/ai-curation/topics`
Lists topics for curation workflows with pagination.

### `GET /api/ai-curation/topics/{topic_id}/words`
Exports a paginated topic word set.

### `GET /api/ai-curation/topics/{topic_id}/export`
Exports a full or lean paginated topic word set.

Query params include:
- `lean`
- `needs_examples_only`
- `page`
- `page_size`

### `POST /api/ai-curation/import`
Imports reviewed AI curation payloads.

## Health and public config

### `GET /health`
Returns service health.

### `GET /api/config/public`
Returns public, non-secret config values for the frontend.

## Trash

### `GET /api/trash/words`
Lists deleted words.

### `GET /api/trash/topics`
Lists deleted topics.

### `POST /api/trash/words/{word_id}/restore`
Restores one deleted word.

### `POST /api/trash/topics/{topic_id}/restore`
Restores one deleted topic.

### `DELETE /api/trash/purge`
Hard-deletes expired trash, or all trash with `force=true`.

## Stats

### `GET /api/stats`
Returns aggregate stats.

### `POST /api/stats/usage`
Records a usage event.

## Mounted in app

The app wiring confirms these router groups exist:

- `health`
- `auth`
- `topics`
- `words`
- `words/suggest`
- `words/agent_router`
- `words/ai_curation`
- `smart_review`
- `trash`
- `stats`

Read their router files before changing those areas.
