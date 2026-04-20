# Architecture summary

## Product purpose

Lexora is a personal English vocabulary learning app centered on:

- topic-based study
- fast review
- knowledge-level progression
- smart review queues
- quick word management

## Runtime shape

### Local development

- Postgres runs in Docker
- backend serves FastAPI on port 8000
- frontend is served on port 5173

### Backend

The FastAPI app mounts routers for:

- health
- auth
- topics
- words
- word topic suggestion
- smart review
- trash
- stats

Protected functional routers are guarded by:

- session cookie verification
- CSRF header verification

### Frontend

Frontend bootstraps React and uses a browser router.

Confirmed routes:

- `/login`
- `/smart-review`
- `/topics/:topicSlug`
- `/words/:wordId`
- `/words/:wordId/edit`
- `/trash`
- `/stats`

## Request flow

### Normal authenticated request

1. user logs in
2. backend returns `csrf_token`
3. frontend stores CSRF token
4. frontend request helper sends:
   - cookies via `credentials: 'include'`
   - `X-CSRF-Token` header when available
5. backend verifies cookie + CSRF before protected routes proceed

### Word update flow

Typical path:

- frontend feature API -> shared HTTP helper
- FastAPI router
- service/repository logic
- SQLAlchemy session / DB
- response schema back to frontend

### Smart review flow

- frontend study page chooses smart review route
- backend returns active queue or generates/refreshes one
- queue item completion updates queue state
- frontend renders resulting queue response

### AI topic suggestion flow

Current path:

1. frontend sends word + translation
2. backend loads all active topics
3. backend composes a prompt containing the full topic list
4. model returns one topic name
5. backend validates that the name exists
6. response returns the selected topic name

This design is simple but will become more expensive as topic count grows.

## Design priorities for future changes

- keep auth contract stable
- preserve small, focused feature boundaries
- prefer deterministic or cached logic before LLM calls
- keep network payloads and model prompts compact
- avoid cross-cutting refactors unless a bug or repeated pain justifies them
