# Backend Refactor Rules

Use these rules for backend cleanup and feature work. The goal is to preserve high cohesion and loose coupling without creating needless file fragmentation.

## Core Rules

- Keep routers thin.
  Routers should handle HTTP concerns only: parse input, call the feature entrypoint, and map domain errors to HTTP responses.

- Keep business rules in the owning feature.
  If a rule belongs to `topics`, `words`, `trash`, `smart_review`, or `stats`, keep it inside that feature instead of scattering it across routers or foreign repositories.

- Keep repositories persistence-focused.
  Repositories should load, save, and query data. Avoid putting orchestration, validation policy, or cross-feature rules there.

- Prefer feature `api.py` for cross-feature access.
  If one feature needs something from another, import from `app.features.<feature>.api` instead of reaching into `repository.py`, `service.py`, `domain.py`, or `repository_queries.py`.

- Add a facade only when cross-feature use is real.
  Do not create `api.py` everywhere by default. Add it when another feature genuinely needs a stable boundary.

- Split by responsibility, not by line count.
  A 250-300 line module is acceptable if it is cohesive. Split only when multiple reasons to change are mixed together.

- Extract pure logic before orchestration.
  If something needs extraction, prefer pure calculations, validation helpers, or stable policy seams. Avoid thin pass-through wrappers.

- Keep feature-local code local.
  Do not move business logic into `app/shared/` unless it is truly technical and cross-cutting.

- Avoid generic abstractions early.
  Solve the concrete case first. Generalize only after multiple real feature needs justify it.

- Preserve the top-level story.
  The main use-case flow should still be readable in one place. Do not hide it behind unnecessary jumps.

## Practical Heuristics

- A large module is acceptable if it still has one clear purpose.
- A small module is not automatically better if it only forwards calls elsewhere.
- Prefer moving code to the feature that owns the concept over creating a new shared layer.
- Treat boundary violations as regressions. Cross-feature imports should prefer feature APIs when available.

## Validation

- Keep `backend/tests/test_feature_boundaries.py` green.
- For structural changes, run the smallest relevant backend pytest target first.
- Before finishing a broader backend refactor, run from `backend/`:

```bash
python3 -m pytest
python3 -m ruff check .
```
