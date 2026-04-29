# Frontend Refactor Playbook

Use this guide when refactoring a React frontend toward the Lexora-style structure.

This document is about source shape, boundaries, and migration order for a modern client-rendered React app in 2026. It is not a claim that React has one official folder tree. React does not prescribe one exact hierarchy. For greenfield apps, React officially recommends starting with a framework. This playbook applies when you are maintaining or restructuring a React frontend that already exists, especially a Vite SPA or similar custom-stack app.

## When To Use This

Use this guide when:

- the frontend is growing past a few screens and file discovery is getting slow
- the source tree is organized by technical layer only, such as `components/`, `hooks/`, `services/`, `types/`
- one change requires touching too many unrelated folders
- route logic, data fetching, and UI are mixed together without boundaries
- the app needs a feature-first structure without rewriting the product

Do not use this guide as a reason for a broad refactor when the user asked for a narrow bug fix.

## Core Position

For a React SPA in 2026, the Lexora structure is a strong modern baseline:

- `app/` owns application composition
- `features/` owns product/domain slices
- `shared/` owns truly cross-cutting code
- `styles/` owns global CSS entrypoints and area-level styles

The important idea is not the folder names themselves. The important idea is ownership.

- A feature should own most of the code required to build and change that feature.
- Shared code should be generic enough that multiple features can use it without feature-specific assumptions.
- App composition should wire things together without becoming a dumping ground for domain logic.

## Target Shape

This is the target source shape used by Lexora:

```text
frontend/src/
  app/
    layout/
    providers.tsx
    queryKeys.ts
    router.tsx
    routes.ts

  features/
    auth/
      api/
      components/
      lib/
    smart-review/
      api/
      components/
      hooks/
    stats/
      api/
      components/
      routes/
    study/
      components/
      hooks/
      routes/
    topics/
      api/
      components/
      hooks/
      model/
    trash/
      api/
      routes/
    words/
      api/
      components/
      hooks/
      model/
      routes/
      services/

  shared/
    api/
    config/
    lib/
    types/
    ui/

  styles/
  test/
```

Not every feature needs every subfolder.

- Add `api/` when the feature talks to the server.
- Add `routes/` when the feature exposes route entrypoints.
- Add `model/` when the feature has non-trivial domain logic, derivations, or formatters.
- Add `services/` when the feature integrates with external workflows that are not pure UI and not generic enough for `shared/`.
- Skip folders that would contain only one trivial file with no real boundary value.

## Layer Responsibilities

### `app/`

`app/` is for application-level composition, not business logic.

Good fits:

- router setup
- global providers
- app layout shell
- app-wide route constants
- app-wide query key registry

Bad fits:

- word-specific API logic
- topic sorting logic
- feature-specific view state
- reusable UI primitives

### `features/`

Each top-level folder under `features/` should map to a user-visible product area or business capability.

Examples from Lexora:

- `words`
- `topics`
- `study`
- `smart-review`
- `trash`
- `stats`
- `auth`

Inside a feature:

- `components/` contains UI pieces owned by that feature
- `routes/` contains route entrypoints and page-level components
- `hooks/` contains feature-specific hooks
- `api/` contains server calls and payload shaping for that feature
- `model/` contains pure domain logic, selectors, transformations, constants, and view-model helpers
- `services/` contains feature-owned orchestration that is not just a presentational hook or raw API function
- `lib/` is acceptable for a small feature-local helper bucket when a more specific subfolder is not justified

### `shared/`

`shared/` should be small and disciplined. It is the easiest folder to abuse.

Good fits:

- HTTP primitives
- config readers
- generic string helpers
- shared type definitions used across multiple features
- reusable UI primitives like confirmation modals

Bad fits:

- feature-specific view helpers
- product language that only one feature understands
- “temporary common” code that really belongs to one feature

Rule: code moves to `shared/` because it is proven generic, not because it is inconvenient to place correctly.

## Import Boundaries

Lexora now enforces several structural rules in ESLint.

### Alias Preference

Prefer `@/…` imports over deep relative imports.

Good:

```ts
import {queryKeys} from '@/app/queryKeys'
import {fetchWords} from '@/features/words/api/wordsApi'
```

Avoid:

```ts
import {queryKeys} from '../../../app/queryKeys'
import {fetchWords} from '../../words/api'
```

Why:

- path intent is clearer
- file moves are cheaper
- imports stop encoding tree depth

### Shared Must Not Depend On Features

`shared/` must not import from `features/` or app composition modules like providers/layout.

Why:

- feature code depends on shared code
- shared code should stay reusable and low-risk
- reverse dependencies create hidden coupling and circular design pressure

### Feature Non-UI Layers Must Not Depend On UI Layers

Inside a feature:

- `api/`, `hooks/`, `model/`, and `services/` must not import `components/`
- `api/`, `hooks/`, `model/`, and `services/` must not import `routes/`

Why:

- domain logic should not depend on rendering code
- route components should compose lower layers, not be imported by them
- testing and extraction become easier

## How To Map A Messy App Into This Shape

The safest migration path is not “move everything at once”. Use staged migration.

### Stage 1: Identify Product Slices

Start by answering:

- what are the user-visible product areas?
- which routes or flows belong to each area?
- which files change together most often?

Those answers define top-level feature folders.

Example mapping:

- `orders`, `cart`, `favorites`, `account` in a store app
- not `components`, `hooks`, `services`, `dto`

### Stage 2: Carve Out `app/`

Move only app-composition concerns first:

- providers
- router
- app shell layout
- route constants
- query keys

This immediately clarifies what the app is made of without touching business logic.

### Stage 3: Move Route Entrypoints Into Features

Pages and route entrypoints should live close to their feature.

Examples:

- `features/words/routes/WordPage.tsx`
- `features/stats/routes/StatsPage.tsx`

This is usually the first moment when the codebase starts to feel navigable.

### Stage 4: Move Feature-Local UI Under Each Feature

If a component is only used by one feature, keep it in that feature.

Examples:

- `features/topics/components/TopicSidebar.tsx`
- `features/words/components/WordTable.tsx`

Do not move it to `shared/ui` just because it is visually “reusable”. If it encodes domain behavior, it is not shared.

### Stage 5: Split Non-UI Logic Out Of Page Components

As route files get large, split them by responsibility:

- UI fragments to `components/`
- stateful orchestration to `hooks/`
- pure calculations and transformations to `model/`
- network calls to `api/`

This is the point where large files become maintainable without inventing backend-style layering everywhere.

### Stage 6: Shrink `shared/`

After feature moves, inspect every file in `shared/`.

Ask:

- is this truly cross-feature?
- is this generic enough to be reused safely?
- does it carry product-specific terminology?

If the answer is no, move it back into a feature.

### Stage 7: Add Structural Guardrails

After the structure is in place, add lint rules.

Without lint guardrails, folder shape decays under delivery pressure.

Guardrails should at least enforce:

- alias imports over deep relative paths
- no feature imports from `shared/`
- no component imports from feature `model/`, `api/`, `hooks/`, or `services/`

## What To Avoid

### Avoid Technical-Layer Top-Level Trees

Avoid this as the primary shape:

```text
src/
  components/
  hooks/
  services/
  types/
  pages/
```

This layout is easy at first and expensive later. It optimizes for file category, not product change.

### Avoid Premature Shared Extraction

Do not create `shared/` wrappers for code that only one feature uses.

Premature sharing creates:

- weak naming
- abstraction leakage
- unnecessary coupling

### Avoid Backend Cosplay

A frontend does not need a strict `controller/service/repository/dto` stack in every feature.

Frontend layers should reflect frontend responsibilities:

- route composition
- UI
- view state
- server calls
- pure domain helpers

### Avoid Big-Bang Rewrites

Do not freeze feature work for a full-tree rewrite unless the user explicitly asks for that tradeoff.

Prefer incremental migration:

- move one feature
- fix imports
- validate
- continue

## How To Decide What Belongs In `model/`

Use `model/` for pure logic with no React rendering dependency.

Good examples:

- sort modes
- filter logic
- derived counts
- formatters
- payload conversion
- route context helpers

Bad examples:

- components with JSX
- hooks that depend on React state
- API functions making network calls

If it can be unit-tested without rendering and without the browser, it is a strong `model/` candidate.

## How To Decide What Belongs In `services/`

Use `services/` sparingly.

A feature service is useful when:

- it orchestrates multiple feature operations
- it integrates with browser or external workflows
- it is not generic enough for `shared/`
- it is not naturally a React hook

If the logic is just “call this endpoint”, prefer `api/`.
If the logic is UI lifecycle and state, prefer `hooks/`.
If the logic is pure transformation, prefer `model/`.

## Lexora-Specific Notes

Lexora is intentionally feature-first, but not all features are equally “pure”.

`study/` is a route-level composition area. That is acceptable.

It composes:

- `topics`
- `smart-review`
- `words`

This is normal in a real product. Not every feature must be perfectly isolated if a route genuinely orchestrates multiple domains.

The important question is whether dependencies are understandable and directional. In Lexora, they are.

## Recommended Refactor Order For Existing Apps

If starting from a typical messy SPA, use this order:

1. Create `app/`, `features/`, and `shared/`.
2. Move router, providers, and layout into `app/`.
3. Define top-level feature folders from product areas.
4. Move page/route files into feature `routes/`.
5. Move feature-only UI into feature `components/`.
6. Move pure helpers into feature `model/`.
7. Move fetch logic into feature `api/`.
8. Move feature-local orchestration into `hooks/` or `services/`.
9. Reduce `shared/` to real cross-cutting utilities only.
10. Add path aliases and lint boundaries.
11. Run tests, lint, and production build after each batch.

## Validation Standard

For Lexora-style refactors, validation should include:

```bash
cd frontend
npm run lint
npm run build
npm test
```

For narrower changes, prefer targeted tests first, then broaden only as needed.

## Final Rule

A modern frontend structure is successful when:

- a developer can guess where code belongs before searching
- a feature change stays mostly inside one feature folder
- shared code is small and trustworthy
- route files compose behavior instead of containing everything
- boundaries are enforced automatically, not socially

That is the standard this playbook is meant to achieve.
