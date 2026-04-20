# Frontend instructions — Lexora

## Stack

- React 19
- TypeScript 5
- Vite 6
- React Router 6
- React Query 5
- Vitest

## Read order

For frontend tasks, start with:

- `frontend/src/app/router.tsx`
- `frontend/src/shared/http.ts`

Then read only the feature files involved in the task.

## Confirmed screens / flows

- login
- smart review
- topic study
- word page / edit page
- trash
- stats

## HTTP contract

Most API calls should go through `frontend/src/shared/http.ts`.

Important behavior already handled there:

- base URL normalization
- JSON content type defaults
- CSRF header injection from localStorage
- `credentials: 'include'`
- API error normalization

Do not duplicate this logic across feature files.

## Routing contract

Keep route changes aligned with `frontend/src/app/router.tsx`:

- `/login`
- `/smart-review`
- `/topics/:topicSlug`
- `/words/:wordId`
- `/words/:wordId/edit`
- `/trash`
- `/stats`

## UI/UX guardrails

- keep study flow fast and low-friction
- avoid adding global state when local feature state is enough
- keep filters, pagination, and quick-add behavior coherent
- preserve mobile drawer / sidebar behavior when editing study layout

## Validation

Use the smallest relevant validation first:

```bash
cd frontend
npm test
npm run lint
npm run build
```

For small scoped work, targeted tests plus a build are usually enough.
