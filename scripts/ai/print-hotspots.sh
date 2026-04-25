#!/usr/bin/env bash
set -euo pipefail

task="${1:-}"

case "$task" in
  ai-curation)
    printf '%s\n' \
      'AGENTS.md' \
      'docs/ai/request-routing-guide.md' \
      'docs/ai/ai-curation-workflow.md' \
      'docs/ai/chatgpt-enrich-examples-prompt.txt' \
      'docs/ai/example-style-guide.md' \
      'backend/AGENTS.md' \
      'backend/app/features/words/ai_curation/' \
      'backend/app/scripts/enrich_examples.py'
    ;;
  backend)
    printf '%s\n' \
      'AGENTS.md' \
      'docs/ai/request-routing-guide.md' \
      'backend/AGENTS.md' \
      'backend/app/main.py' \
      'backend/app/features/<feature>/' \
      'backend/tests/features/<feature>/'
    ;;
  frontend)
    printf '%s\n' \
      'AGENTS.md' \
      'docs/ai/request-routing-guide.md' \
      'frontend/AGENTS.md' \
      'frontend/src/features/<feature>/' \
      'frontend/src/shared/http.ts'
    ;;
  docs)
    printf '%s\n' \
      'AGENTS.md' \
      'docs/ai/README.md' \
      'docs/ai/request-routing-guide.md' \
      'docs/ai/repo-map.md' \
      'docs/ai/token-budget-rules.md'
    ;;
  *)
    cat >&2 <<'EOF'
Usage: scripts/ai/print-hotspots.sh <task-type>

Task types:
  ai-curation
  backend
  frontend
  docs
EOF
    exit 1
    ;;
esac
