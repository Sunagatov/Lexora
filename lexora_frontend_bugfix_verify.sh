#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
cd "$ROOT_DIR/frontend"

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo

npm install
npm run lint
npm run test
npm run build

echo
echo "Frontend verification passed."
