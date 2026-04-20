Lexora Frontend bugfix scripts

Files:
- lexora_frontend_bugfix_apply.sh
- lexora_frontend_bugfix_verify.sh

What the apply script fixes:
1. Reactive footer counts for words/topics
2. Word page prev/next now subscribes to the words query instead of reading stale cache once
3. Word page Back button no longer navigates to /topics/ when topic resolution fails
4. Word edit payload now deduplicates topic_ids
5. Trash restore flows now invalidate affected caches properly
6. Safer API base URL behavior + Vite dev proxy for /api and /auth
7. ESLint is configured for TypeScript/TSX instead of effectively skipping real frontend code

How to run:
1. Copy both .sh files into the Lexora repo root
2. chmod +x lexora_frontend_bugfix_apply.sh lexora_frontend_bugfix_verify.sh
3. ./lexora_frontend_bugfix_apply.sh
4. ./lexora_frontend_bugfix_verify.sh

Optional:
- Commit your current state before applying, so rollback is easy
- The apply script also creates a timestamped backup folder inside the repo root
