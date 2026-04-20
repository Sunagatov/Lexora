#!/usr/bin/env bash
set -euo pipefail

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

cd frontend
npm run lint
npm run test
npm run build

echo "Lexora frontend verification passed."
