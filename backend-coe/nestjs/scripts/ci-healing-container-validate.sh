#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${BACKEND_DIR}/../.." && pwd)"

COMPOSE_FILE="${CI_HEALING_CONTAINER_COMPOSE_FILE:-${REPO_ROOT}/docker-compose.integration.yml}"
BACKEND_ENV_FILE="${CI_HEALING_CONTAINER_BACKEND_ENV_FILE:-${BACKEND_DIR}/.env}"
HEALTH_URL="${CI_HEALING_CONTAINER_HEALTH_URL:-http://127.0.0.1:3000/health}"
PROJECT_NAME="${CI_HEALING_CONTAINER_PROJECT_NAME:-healops-validate}"
HEALTH_RETRIES="${CI_HEALING_CONTAINER_HEALTH_RETRIES:-30}"
HEALTH_SLEEP_SECONDS="${CI_HEALING_CONTAINER_HEALTH_SLEEP_SECONDS:-2}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ci-healing-validate] docker CLI is not installed."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ci-healing-validate] docker daemon is not running."
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[ci-healing-validate] compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${BACKEND_ENV_FILE}" ]]; then
  echo "[ci-healing-validate] backend env file not found: ${BACKEND_ENV_FILE}"
  exit 1
fi

cleanup() {
  docker compose \
    -f "${COMPOSE_FILE}" \
    --env-file "${BACKEND_ENV_FILE}" \
    -p "${PROJECT_NAME}" \
    down --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[ci-healing-validate] building backend images"
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${BACKEND_ENV_FILE}" \
  -p "${PROJECT_NAME}" \
  build backend-migrate backend-api backend-worker

echo "[ci-healing-validate] starting postgres and redis"
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${BACKEND_ENV_FILE}" \
  -p "${PROJECT_NAME}" \
  up -d postgres redis

echo "[ci-healing-validate] running backend migrations in container"
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${BACKEND_ENV_FILE}" \
  -p "${PROJECT_NAME}" \
  up --abort-on-container-exit --exit-code-from backend-migrate backend-migrate

echo "[ci-healing-validate] starting backend api + worker"
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${BACKEND_ENV_FILE}" \
  -p "${PROJECT_NAME}" \
  up -d backend-api backend-worker

echo "[ci-healing-validate] waiting for health endpoint: ${HEALTH_URL}"
for ((i=1; i<=HEALTH_RETRIES; i++)); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "[ci-healing-validate] health check passed"
    exit 0
  fi
  sleep "${HEALTH_SLEEP_SECONDS}"
done

echo "[ci-healing-validate] health check failed after ${HEALTH_RETRIES} attempts"
exit 1
