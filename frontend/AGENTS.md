# Frontend Agent Notes

Frontend source lives in `frontend/src/`. Read `AGENTS.md` and `docs/ai/request-routing-guide.md` before using this module note.

For frontend structure or reorganization work, also read `docs/ai/frontend-refactor-playbook.md`.

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
- app providers/layout: `frontend/src/app/providers.tsx`, `frontend/src/app/layout/*`
- HTTP behavior: `frontend/src/shared/api/http.ts`
- route constants: `frontend/src/app/routes.ts`
- query keys/cache: `frontend/src/app/queryKeys.ts`
- shared domain types: `frontend/src/shared/types/index.ts`

## Source Shape

- `frontend/src/app/`
- `frontend/src/features/auth/`
- `frontend/src/features/study/`
- `frontend/src/features/topics/`
- `frontend/src/features/words/`
- `frontend/src/features/smart-review/`
- `frontend/src/features/trash/`
- `frontend/src/features/stats/`
- `frontend/src/shared/`
- `frontend/src/styles/`

## Local Rules

- Keep API calls on the shared HTTP path unless a task explicitly changes transport behavior.
- Prefer `@/…` imports over deep relative paths.
- Keep route changes aligned with `frontend/src/app/router.tsx`.
- Keep feature changes scoped when possible.
- Preserve many-to-many topic behavior and topic hierarchy when editing word/topic UI.
- Keep `shared/` free of feature dependencies.
- Keep feature `api/`, `hooks/`, `model/`, and `services/` free of route/component imports.

## Validation

From `frontend/`, prefer targeted Vitest coverage first. Broader local checks are:

```bash
npm test
npm run lint
npm run build
```
