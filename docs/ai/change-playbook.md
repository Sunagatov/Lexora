# Change playbook

Use this to keep code changes fast, targeted, and low-token.

## 1. Backend bug fix

Read:

- `backend/AGENTS.md`
- target router
- target service/repository
- `backend/app/shared/config.py` or `deps.py` only if auth/config/db is involved

Then:

- patch the smallest surface possible
- keep status codes and payload shape stable
- add or update targeted tests

## 2. Frontend bug fix

Read:

- `frontend/AGENTS.md`
- target page/component/hook
- related API file
- `frontend/src/shared/http.ts` only if transport/auth behavior matters

Then:

- preserve existing route and request contracts
- prefer local state fixes over new global plumbing
- validate with targeted tests + build

## 3. Full-stack feature

Read:

- one backend feature slice
- one frontend feature slice
- only the shared files connecting them

Avoid reading unrelated features.

## 4. AI-related feature

Read:

- `backend/app/features/words/suggest_router.py`
- `backend/app/features/words/suggest_service.py`
- `docs/ai/ai-cost-reduction-backlog.md`

Then decide in this order:

1. Can it be solved without a model?
2. Can candidate options be reduced before the model?
3. Can repeated results be cached?
4. Can output be reduced to ID / enum instead of long text?
5. Can observability be added cheaply?

## 5. When to stop reading more files

Stop once you can answer all of these:

- Where does the request enter?
- Where is the business rule applied?
- Where is the response shaped?
- What shared contract must stay stable?
- What is the smallest useful regression test?

If you can answer those, you probably have enough context.
