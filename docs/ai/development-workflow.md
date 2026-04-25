# Development Workflow

Use the smallest safe local validation that matches the change.

## Backend

From `backend/`:

```bash
python -m pytest
ruff check .
```

For narrow changes, prefer the directly related pytest file first.

## Frontend

From `frontend/`:

```bash
npm test
npm run lint
npm run build
```

For narrow changes, prefer related Vitest tests first, then build when the change affects app code.

## Docs

For AI documentation architecture changes:

```bash
bash scripts/ai/check-ai-docs.sh
```

Do not run Docker, deployment, SSH, backup, restore, production, or secret commands unless the user explicitly asks for that operational task.
