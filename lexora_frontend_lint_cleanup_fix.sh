#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# If the script was copied into the repo root, ROOT_DIR is the repo root.
# If it is executed from elsewhere, allow overriding by passing the repo path as arg1.
if [[ $# -ge 1 ]]; then
  REPO_DIR="$1"
else
  REPO_DIR="$PWD"
fi

cd "$REPO_DIR"

if [[ ! -d frontend ]]; then
  echo "Error: frontend directory not found. Run this from the Lexora repo root or pass the repo path as the first argument."
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".lexora_frontend_lint_cleanup_fix_backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR/frontend"

backup_if_exists() {
  local path="$1"
  if [[ -e "$path" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$path")"
    cp -R "$path" "$BACKUP_DIR/$path"
  fi
}

backup_if_exists ".gitignore"
backup_if_exists "frontend/eslint.config.js"
backup_if_exists "frontend/vite.config.js"
backup_if_exists "frontend/vite.config.d.ts"
backup_if_exists "frontend/tsconfig.app.tsbuildinfo"
backup_if_exists "frontend/tsconfig.node.tsbuildinfo"
backup_if_exists "frontend/dist"

cat > frontend/eslint.config.js <<'ESLINTEOF'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

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

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      '.vite',
      '.vite-temp',
      '*.tsbuildinfo',
      'vite.config.js',
      'vite.config.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {jsx: true},
      },
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
)
ESLINTEOF

python3 - <<'PY'
from pathlib import Path
path = Path('.gitignore')
current = path.read_text() if path.exists() else ''
needed = [
    'frontend/*.tsbuildinfo',
    'frontend/vite.config.js',
    'frontend/vite.config.d.ts',
]
missing = [line for line in needed if line not in current.splitlines()]
if missing:
    suffix = '\n' if current and not current.endswith('\n') else ''
    block = '\n# Frontend generated config/build artifacts\n' + '\n'.join(missing) + '\n'
    path.write_text(current + suffix + block)
PY

rm -f frontend/vite.config.js frontend/vite.config.d.ts
rm -f frontend/tsconfig.app.tsbuildinfo frontend/tsconfig.node.tsbuildinfo
rm -rf frontend/dist

cd frontend
npm run lint
npm run test
npm run build

cat <<DONE
Lexora frontend lint + cleanup patch applied successfully.
Backup created in: ${BACKUP_DIR}

Cleaned files:
  - frontend/vite.config.js
  - frontend/vite.config.d.ts
  - frontend/tsconfig.app.tsbuildinfo
  - frontend/tsconfig.node.tsbuildinfo
  - frontend/dist (rebuilt fresh)
DONE
