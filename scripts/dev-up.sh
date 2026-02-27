#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.run-logs"
PID_FILE="$LOG_DIR/dev-supervisor.pid"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(cat "$PID_FILE")"
  if kill -0 "$existing_pid" >/dev/null 2>&1; then
    echo "Dev supervisor is already running (PID: $existing_pid)."
    echo "Run ./scripts/dev-down.sh first if you want to restart it."
    exit 1
  fi
  rm -f "$PID_FILE"
fi

echo $$ > "$PID_FILE"

cleanup() {
  rm -f "$PID_FILE"
  local children
  children="$(jobs -pr)"
  if [[ -n "$children" ]]; then
    kill $children >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

use_project_node() {
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    . "$NVM_DIR/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || true
    return
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || true
  fi
}

prepare_backend() {
  cd "$ROOT_DIR/backend-coe/nestjs"
  use_project_node

  if [[ ! -f .env && -f .env.example ]]; then
    cp .env.example .env
  fi

  if [[ -d apm/prometheus.yml ]]; then
    echo "Found directory at apm/prometheus.yml; replacing with generated file path"
    rm -rf apm/prometheus.yml
  fi

  pnpm run generate:prometheus
  pnpm install --no-frozen-lockfile --engine-strict=false
  pnpm run db:dev:up
  pnpm run db:migrate
}

prepare_frontend() {
  cd "$ROOT_DIR/frontend-coe"
  use_project_node

  if [[ ! -f .env && -f .env.example ]]; then
    cp .env.example .env
  fi

  pnpm install --frozen-lockfile
}

backend_loop() {
  while true; do
    echo "[$(date '+%H:%M:%S')] starting backend (watch mode)" | tee -a "$LOG_DIR/backend.log"
    (
      cd "$ROOT_DIR/backend-coe/nestjs"
      use_project_node
      pnpm run start:dev
    ) >>"$LOG_DIR/backend.log" 2>&1 || true

    echo "[$(date '+%H:%M:%S')] backend exited, restarting in 2s" | tee -a "$LOG_DIR/backend.log"
    sleep 2
  done
}

frontend_loop() {
  while true; do
    echo "[$(date '+%H:%M:%S')] starting frontend (dev mode)" | tee -a "$LOG_DIR/frontend.log"
    (
      cd "$ROOT_DIR/frontend-coe"
      use_project_node
      pnpm run dev
    ) >>"$LOG_DIR/frontend.log" 2>&1 || true

    echo "[$(date '+%H:%M:%S')] frontend exited, restarting in 2s" | tee -a "$LOG_DIR/frontend.log"
    sleep 2
  done
}

echo "Preparing backend dependencies/services..."
prepare_backend

echo "Preparing frontend dependencies..."
prepare_frontend

echo "Starting backend + frontend supervisor..."
backend_loop &
frontend_loop &

wait
