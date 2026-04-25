# Frontend Agent Notes

Frontend source lives in `frontend/src/`. Read `AGENTS.md` and `docs/ai/request-routing-guide.md` before using this module note.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- React Query
- Vitest
- ESLint

## Read Order

For frontend work, start with the target feature folder and nearby tests. Only add shared files when needed:

- routes: `frontend/src/app/router.tsx`
- HTTP behavior: `frontend/src/shared/http.ts`
- route constants: `frontend/src/shared/routes.ts`
- query keys/cache: `frontend/src/shared/queryKeys.ts`
- shared domain types: `frontend/src/shared/types.ts`

## Source Shape

- `frontend/src/features/auth/`
- `frontend/src/features/study/`
- `frontend/src/features/topics/`
- `frontend/src/features/words/`
- `frontend/src/features/smart-review/`
- `frontend/src/features/trash/`
- `frontend/src/features/stats/`
- `frontend/src/layout/`
- `frontend/src/shared/`
- `frontend/src/styles/`

## Local Rules

- Keep API calls on the shared HTTP path unless a task explicitly changes transport behavior.
- Keep route changes aligned with `frontend/src/app/router.tsx`.
- Keep feature changes scoped when possible.
- Preserve many-to-many topic behavior and topic hierarchy when editing word/topic UI.

## Validation

From `frontend/`, prefer targeted Vitest coverage first. Broader local checks are:

```bash
npm test
npm run lint
npm run build
```
