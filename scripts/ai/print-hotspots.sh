#!/usr/bin/env bash
set -euo pipefail

task="${1:-}"

case "$task" in
  ai-curation)
    printf '%s\n' \
      'AGENTS.md' \
      '.claude/generated/request-routing.md' \
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
      '.claude/generated/request-routing.md' \
      'backend/AGENTS.md' \
      'backend/app/main.py' \
      'backend/app/shared/config.py' \
      'backend/app/shared/deps.py' \
      'backend/app/features/<feature>/'
    ;;
  frontend)
    printf '%s\n' \
      'AGENTS.md' \
      '.claude/generated/request-routing.md' \
      'frontend/AGENTS.md' \
      'frontend/src/shared/http.ts' \
      'frontend/src/shared/routes.ts' \
      'frontend/src/features/<feature>/'
    ;;
  vault)
    printf '%s\n' \
      'CLAUDE.md' \
      '.claude/generated/request-routing.md' \
      '.claude/generated/app-surfaces.md' \
      'README.md' \
      'STRUCTURE.md' \
      'config/apps.yaml' \
      'scripts/lib/manifest.sh' \
      'Taskfile.yml'
    ;;
  *)
    cat >&2 <<'EOF'
Usage: scripts/ai/print-hotspots.sh <task-type>

Task types:
  ai-curation
  backend
  frontend
  vault
EOF
    exit 1
    ;;
esac
