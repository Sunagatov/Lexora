#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
cd "$ROOT_DIR"

if [[ ! -d frontend ]]; then
  echo "Error: frontend directory not found. Run this from the Lexora repo root or pass the repo path as the first argument."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".lexora_frontend_lint_followup_backup_${STAMP}"
mkdir -p "$BACKUP_DIR/frontend/src/features/words" "$BACKUP_DIR/frontend/src/shared" "$BACKUP_DIR/frontend"

cp -f frontend/eslint.config.js "$BACKUP_DIR/frontend/eslint.config.js" 2>/dev/null || true
cp -f frontend/src/features/words/useWordFilter.ts "$BACKUP_DIR/frontend/src/features/words/useWordFilter.ts" 2>/dev/null || true
cp -f frontend/src/shared/wordDomain.ts "$BACKUP_DIR/frontend/src/shared/wordDomain.ts" 2>/dev/null || true

cat > frontend/eslint.config.js <<'EOF'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  alert: 'readonly',
  console: 'readonly',
  KeyboardEvent: 'readonly',
  React: 'readonly',
}

export default [
  {ignores: ['dist', 'coverage']},
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: browserGlobals,
    },
    plugins: {'react-hooks': reactHooks},
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
]
EOF

python3 <<'PY'
from pathlib import Path

# Fix statement-style ternary that stricter lint flags.
p = Path('frontend/src/features/words/useWordFilter.ts')
text = p.read_text()
old = """      const next = new URLSearchParams(prev)\n      value === null || value === '' ? next.delete(key) : next.set(key, value)\n      if (resetPage) next.delete('page')\n      return next\n"""
new = """      const next = new URLSearchParams(prev)\n      if (value === null || value === '') next.delete(key)\n      else next.set(key, value)\n      if (resetPage) next.delete('page')\n      return next\n"""
if old not in text:
    raise SystemExit('Expected block not found in frontend/src/features/words/useWordFilter.ts')
p.write_text(text.replace(old, new))

# Fix const suggestion.
p = Path('frontend/src/shared/wordDomain.ts')
text = p.read_text()
old = "  let result = words.filter((w) => {\n"
new = "  const result = words.filter((w) => {\n"
if old not in text:
    raise SystemExit('Expected block not found in frontend/src/shared/wordDomain.ts')
p.write_text(text.replace(old, new))
PY

echo "Lexora frontend lint follow-up patch applied."
echo "Backup created in: $BACKUP_DIR"
echo
echo "Next:"
echo "  cd frontend"
echo "  npm run lint"
echo "  npm run test"
echo "  npm run build"
