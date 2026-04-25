#!/usr/bin/env bash
set -euo pipefail

failures=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}

pass() {
  printf 'PASS: %s\n' "$1"
}

line_count() {
  if [ -f "$1" ]; then
    wc -l < "$1" | tr -d ' '
  else
    printf '0'
  fi
}

grep_active() {
  pattern="$1"
  shift
  grep -RInE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=build \
    --exclude-dir=dist \
    --exclude-dir=target \
    --exclude-dir=.gradle \
    --exclude-dir=.next \
    --exclude-dir=docs/archive \
    --exclude='*.env' \
    --exclude='*.env.*' \
    --exclude='*.enc' \
    --exclude='*.pem' \
    --exclude='*.key' \
    --exclude='*.crt' \
    "$pattern" "$@" 2>/dev/null | grep -v '^scripts/ai/check-ai-docs\.sh:' || true
}

require_file() {
  if [ -f "$1" ]; then
    pass "$1 exists"
  else
    fail "$1 is missing"
  fi
}

require_file AGENTS.md
require_file docs/ai/README.md
require_file docs/ai/request-routing-guide.md
require_file docs/ai/repo-map.md
require_file docs/ai/token-budget-rules.md
require_file docs/ai/invariants.md
require_file docs/ai/ai-curation-workflow.md
require_file CODEX.md
require_file CLAUDE.md
require_file AMAZONQ.md
require_file .amazonq/rules/00-entrypoint.md

for adapter in CLAUDE.md CODEX.md AMAZONQ.md .amazonq/rules/00-entrypoint.md .claude/request-routing.md .claude/generated/request-routing.md .github/copilot-instructions.md backend/CLAUDE.md frontend/CLAUDE.md; do
  if [ -f "$adapter" ]; then
    lines="$(line_count "$adapter")"
    if [ "$lines" -le 35 ]; then
      pass "$adapter is thin ($lines lines)"
    else
      fail "$adapter is too large for an adapter ($lines lines)"
    fi
  fi
done

if [ -f docs/archive/README.md ]; then
  pass "archive has inactive-context README"
else
  fail "docs/archive/README.md is missing"
fi

active_stale="$(grep_active 'PycharmProjects|Frontend Placeholder|intentionally empty for now|backend/app/features/words/suggest_service\.py|app-surfaces\.md|STRUCTURE\.md|prod:(migrate|deploy|release|ship)|/Users/.*/Vault|view\.sh lexora-backend|Cloudy' AGENTS.md CLAUDE.md CODEX.md AMAZONQ.md README.md backend frontend docs/ai .claude .amazonq .github scripts)"
if [ -n "$active_stale" ]; then
  printf '%s\n' "$active_stale" >&2
  fail "active docs contain discovered stale/conflicting Lexora terms"
else
  pass "no discovered stale/conflicting terms in active docs"
fi

secret_context="$(grep_active '(read|print|copy|show|dump|expose).{0,40}(secret|token|credential|certificate|private key|\.env)|secret.{0,40}(as|for).{0,20}context' AGENTS.md CLAUDE.md CODEX.md AMAZONQ.md README.md backend frontend docs/ai .claude .amazonq .github scripts)"
disallowed_secret_context="$(printf '%s\n' "$secret_context" | grep -Eiv 'do not|never|without secret values|not documentation|Avoid|must never|Do not encourage' || true)"
if [ -n "$disallowed_secret_context" ]; then
  printf '%s\n' "$disallowed_secret_context" >&2
  fail "docs appear to encourage reading or printing secrets"
else
  pass "docs do not encourage secret exposure"
fi

if [ -f docs/ai/BUG_TRACKER.md ] || [ -f docs/ai/WORD_DEDUPLICATION_MIGRATION.md ]; then
  fail "historical AI docs still appear in docs/ai as active context"
else
  pass "historical AI docs are not active docs/ai context"
fi

curation_v1_refs="$(grep_active 'lexora\.ai-curation\.v1|v1 import payload shape' AGENTS.md CLAUDE.md CODEX.md AMAZONQ.md README.md backend/*.md frontend/*.md docs/ai .claude .amazonq .github scripts)"
if [ -n "$curation_v1_refs" ]; then
  printf '%s\n' "$curation_v1_refs" >&2
  fail "active docs present old AI curation v1 wording"
else
  pass "active docs do not present AI curation v1 as current"
fi

legacy_payload_refs="$(grep_active 'word_operations|create_new_word|update_existing_word|reassign_word_topics' AGENTS.md CLAUDE.md CODEX.md AMAZONQ.md README.md backend/*.md frontend/*.md docs/ai .claude .amazonq .github scripts)"
bad_legacy_payload_refs="$(
  printf '%s\n' "$legacy_payload_refs" \
    | grep -Eiv 'legacy|backward-compatibility|compatibility only|not the current recommended|Do not use the legacy|old `word_operations`|replaces? the old|translated into v2|checks? active docs|allow|accepted.*only as' \
    || true
)"
if [ -n "$bad_legacy_payload_refs" ]; then
  printf '%s\n' "$bad_legacy_payload_refs" >&2
  fail "active docs recommend legacy AI curation payload names as current"
else
  pass "legacy AI curation payload names are compatibility-only in active docs"
fi

if [ -f docs/ai/ai-curation.md ] && [ -f docs/ai/ai-curation-workflow.md ]; then
  curation_lines="$(line_count docs/ai/ai-curation.md)"
  if [ "$curation_lines" -le 45 ] && grep -q 'canonical current workflow' docs/ai/ai-curation.md; then
    pass "ai-curation.md is a compact pointer/reference"
  else
    fail "ai-curation.md looks like a duplicate full workflow doc"
  fi
fi

generated_refs="$(grep -RInE 'generated/request-routing\.md' AGENTS.md CLAUDE.md CODEX.md AMAZONQ.md README.md backend frontend docs/ai .amazonq .github scripts 2>/dev/null | grep -v '^scripts/ai/check-ai-docs\.sh:' || true)"
bad_generated_refs="$(printf '%s\n' "$generated_refs" | grep -v 'compatibility pointer' || true)"
if [ -n "$bad_generated_refs" ]; then
  printf '%s\n' "$bad_generated_refs" >&2
  fail "active docs point agents to generated routing instead of canonical routing"
else
  pass "active docs route through canonical request-routing guide"
fi

if [ "$failures" -eq 0 ]; then
  printf 'PASS: AI documentation drift check completed\n'
else
  printf 'FAIL: AI documentation drift check found %s issue(s)\n' "$failures" >&2
  exit 1
fi
