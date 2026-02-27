#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.run-logs/dev-supervisor.pid"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "Stopping dev supervisor PID $pid"
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

pkill -f "next dev --turbopack" >/dev/null 2>&1 || true
pkill -f "nest start --watch" >/dev/null 2>&1 || true
pkill -f "worker.main.ts" >/dev/null 2>&1 || true

echo "Dev services stopped."
