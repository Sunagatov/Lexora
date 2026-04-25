# Environment And Configuration Reference

This file lists names and themes only. Do not add real values.

## Backend Runtime Config

Source: `backend/app/shared/config.py`.

Database:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`

App runtime:

- `APP_HOST`
- `APP_PORT`
- `APP_DEBUG`

Auth and security:

- `APP_PASSWORD`
- `SECRET_KEY`
- `COOKIE_MAX_AGE`
- `COOKIE_HTTPONLY`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `API_KEY`

Smart review:

- `SMART_REVIEW_ENABLED`
- `SMART_REVIEW_LEVEL_1_COUNT`
- `SMART_REVIEW_LEVEL_2_COUNT`
- `SMART_REVIEW_LEVEL_3_COUNT`
- `SMART_REVIEW_LEVEL_4_COUNT`
- `SMART_REVIEW_LEVEL_5_COUNT`
- `SMART_REVIEW_COOLDOWN_DAYS`
- `SMART_REVIEW_MAX_PER_TOPIC`
- `SMART_REVIEW_QUEUE_TTL_HOURS`

Other runtime settings:

- `TRASH_RETENTION_DAYS`
- `CORS_ALLOWED_ORIGINS`

AI topic suggestion runtime settings:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

## Frontend Build/Runtime Config

Sources: `.env.example`, `frontend/src/vite-env.d.ts`, and Vite config.

- `VITE_API_BASE_URL`
- `VITE_PAGE_SIZES`
- `VITE_DEFAULT_PAGE_SIZE`

Vite dev server proxies `/api` and `/auth` to the local backend.

## Operational Script-Only Variables

Sources: `backend/app/scripts/enrich_examples.py`, `backend/app/scripts/split_large_topics.py`, and `docs/ai/ai-curation-workflow.md`.

These variables are for optional operational scripts, not normal app runtime config:

- `PROD_PASSWORD` — used by scripts that log in to an API URL.
- `GEMINI_API_KEY` — used by `enrich_examples.py` when provider is Gemini.
- `OPENAI_API_KEY` — used by `enrich_examples.py` when provider is OpenAI; also a backend runtime setting for topic suggestion.
- `ANTHROPIC_API_KEY` — used by `enrich_examples.py` when provider is Anthropic.

Script flags, not env vars:

- `--provider` selects `gemini`, `openai`, or `anthropic`.
- `--model` overrides the provider default model.
- `--prod-url` changes the API URL used by operational scripts.

Do not run operational scripts unless the user explicitly requests that work. Do not document or expose real credentials.
