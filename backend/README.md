# Lexora Backend

FastAPI backend for Lexora.

## Tech stack

- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- Pydantic Settings
- pytest
- ruff

## Local Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Use example env files as templates only. Do not commit real secrets or private environment values.

## Local Checks

```bash
python -m pytest
ruff check .
```

For narrow changes, prefer the directly related pytest file first.

## Logging

- Default policy: keep routine successful requests at `DEBUG`, reserve `INFO` for meaningful business or control-plane receipts, use `WARNING` for degraded/recoverable conditions, and `ERROR` for unexpected request failures.
- Event names should be stable `lower_snake_case` values with safe searchable context such as `request_id`, `correlation_id`, `subject`, `topic_id`, `status_code`, or `duration_ms`.
- The app propagates inbound `X-Request-ID` when present, generates one when missing, and returns both `X-Request-ID` and `X-Correlation-ID` in normal responses.
- Never log secrets, tokens, raw auth headers, passwords, or raw request/response bodies.
- Use `LOG_FORMAT=json` for structured container logs when needed; enable `DEBUG` temporarily for diagnosis rather than adding new routine INFO logs.

## AI-Agent Guidance

Read `../AGENTS.md`, `../docs/ai/request-routing-guide.md`, and `AGENTS.md` in this directory. Keep backend docs module-scoped; repo-wide AI context belongs in `../docs/ai/`.
