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

If the root route is changed, keep it on the faster dashboard-style screen rather than a slow study screen when that matches current product direction.

## UI/UX guardrails

- keep study flow fast and low-friction
- avoid adding global state when local feature state is enough
- keep filters, pagination, and quick-add behavior coherent
- preserve mobile drawer / sidebar behavior when editing study layout

## Topic and word editing notes

- word edit mode supports multiple topic memberships; do not reduce it back to a single-topic swap
- topic lists now render as a tree when parent topics exist
- subtopics are still topics; keep the hierarchy visible in the UI
- root navigation should stay on the faster dashboard-style screen if the product already uses one
- keep broad umbrella topics visible when adding subtopics
- prefer clear topic boundaries over creating many similar siblings
- do not route the app back to a slow landing page if a faster dashboard-style screen already exists

## Frontend correctness invariants

- when active words or topics change, invalidate the dependent caches that drive stats, smart review, and trash views
- Smart Review should not render sidebar counts and progress from stale word data while the shared word cache is still loading
- the mobile study drawer should reset on route enter and exit so drawer state does not leak between screens
- clamp or normalize out-of-range pagination params back into the URL instead of letting the UI and URL disagree
- keep the tree hierarchy and many-to-many topic membership intact in the UI

## Validation

Use the smallest relevant validation first:

```bash
cd frontend
npm test
npm run lint
npm run build
```

For small scoped work, targeted tests plus a build are usually enough.
