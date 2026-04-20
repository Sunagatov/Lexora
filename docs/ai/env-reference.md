# Environment and configuration reference

This is a compact operator view for coding assistants.

## Backend config themes

Defined in `backend/app/shared/config.py`:

### Database
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`

### App runtime
- `APP_HOST`
- `APP_PORT`
- `APP_DEBUG`

### Auth / security
- `APP_PASSWORD`
- `SECRET_KEY`
- `COOKIE_MAX_AGE`
- `COOKIE_HTTPONLY`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `API_KEY`

### Smart review tuning
- `SMART_REVIEW_ENABLED`
- per-level counts
- cooldown days
- max per topic
- queue TTL hours

### Trash
- `TRASH_RETENTION_DAYS`

### CORS
- `CORS_ALLOWED_ORIGINS`

### AI topic suggestion
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

## Docker compose summary

- postgres service
- backend service using `.env`
- frontend build args:
  - `VITE_API_BASE_URL`
  - `VITE_PAGE_SIZES`
  - `VITE_DEFAULT_PAGE_SIZE`

## Important implication for AI tools

When diagnosing behavior, always check whether the issue could be config-driven before proposing code changes.
