# Lexora Invariants

These rules should not be violated without explicit user instruction.

## Repository Ownership

- Lexora source owns application code, tests, and source-level documentation.
- Runtime/deployment configuration and secret material are outside the source-doc source of truth.
- Do not move runtime/deployment truth or secret values into Lexora docs.

## Documentation

- `AGENTS.md` is the AI bootloader.
- `docs/ai/*` owns repo-wide AI-agent current context.
- Agent-specific files are adapters only.
- Do not duplicate long current-state summaries across agent entrypoints.
- Archive docs are not active guidance.

## Security

- Never expose secrets, tokens, certificates, keys, private env values, or secret payloads.
- Do not encourage agents to read or print secrets as context.
- Authenticated backend behavior relies on session cookies and CSRF verification for protected routers.

## Code And Architecture

- Preserve existing architecture unless the task explicitly asks for a refactor.
- Keep backend work aligned with router/service/repository/schema boundaries where those boundaries exist.
- Keep frontend work feature-local when possible and use shared HTTP behavior for API calls.
- Do not change public API contracts without corresponding tests and docs.
- Do not add unnecessary dependencies.
- Prefer simple, maintainable changes over speculative abstractions.
