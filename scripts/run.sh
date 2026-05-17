#!/usr/bin/env bash
# One-step launcher for Taskloom (macOS / Linux).
# Installs dependencies on first run, loads .env, checks for an AI provider,
# opens the browser, and starts the dev server.

set -e

cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies (one-time, ~1 minute)..."
  npm install
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

node scripts/preflight.mjs

echo "Opening http://localhost:7341/builder in your browser..."
(
  sleep 3
  if command -v open >/dev/null 2>&1; then
    open http://localhost:7341/builder >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:7341/builder >/dev/null 2>&1 || true
  fi
) &

npm run dev
