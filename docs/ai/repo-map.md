# Repo map (compact)

This is a **working map**, not a full file listing.

## Root

- `README.md`
- `docker-compose.yml`
- `backend/`
- `frontend/`

## Backend

Start here for backend changes:

- `backend/app/main.py` — app wiring, middleware, mounted routers
- `backend/app/shared/config.py` — settings and env-driven config
- `backend/app/shared/deps.py` — DB session, session auth, CSRF auth, API key auth

Representative feature folders confirmed from app wiring:

- `backend/app/features/auth/`
- `backend/app/features/health/`
- `backend/app/features/topics/`
- `backend/app/features/words/`
- `backend/app/features/smart_review/`
- `backend/app/features/trash/`
- `backend/app/features/stats/`

Representative files inspected:

- `backend/app/features/auth/router.py`
- `backend/app/features/topics/router.py`
- `backend/app/features/words/router.py`
- `backend/app/features/words/suggest_router.py`
- `backend/app/features/words/suggest_service.py`
- `backend/app/features/smart_review/router.py`

## Frontend

Start here for frontend changes:

- `frontend/src/main.tsx` — app bootstrap
- `frontend/src/app/router.tsx` — route table
- `frontend/src/shared/http.ts` — shared request helper
- `frontend/src/features/words/api.ts` — word-related API client
- `frontend/src/features/study/StudyPage.tsx` — main study screen

## Quick lookup by task

### Login/auth problem
Read:
- backend auth router
- backend shared deps
- frontend shared http
- login feature files

### Topic CRUD problem
Read:
- topics router/service/repository/schemas
- any topic UI components/hooks

### Word CRUD or filtering problem
Read:
- words router/service/repository/schemas
- `frontend/src/features/words/api.ts`
- study page / word collection components

### Smart review problem
Read:
- smart review router/service/model/schemas
- smart review frontend view/state files

### AI topic suggestion problem
Read:
- `backend/app/features/words/suggest_router.py`
- `backend/app/features/words/suggest_service.py`
- any quick-add or suggestion UI that calls it

## Hard rule

For most tasks, you should not need more than:
- 1 agent file
- 3–8 source files
- 1–3 shared helper/config files
