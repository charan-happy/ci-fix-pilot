# CI Healing Env Setup (Backend + Frontend)

This is the minimum environment setup for a **working self-healing CI flow** with:
- webhook ingest
- retry loop
- Slack notifications
- optional PR automation
- **container-first validation gate** (required before PR)

## 1) Backend required envs (`backend-coe/nestjs/.env`)

### Core runtime
- `PORT=3002`
- `NODE_ENV=development`
- `CORS_ORIGINS=http://localhost:3001`

### Database + queue
- `POSTGRES_HOST=127.0.0.1`
- `POSTGRES_PORT=5432`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`
- `POSTGRES_DB=postgres`
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres`
- `REDIS_HOST=127.0.0.1`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=your_password_here`
- `REDIS_TLS_ENABLED=false`

### Auth baseline
- `JWT_SECRET=your-super-secret-jwt-key-change-in-production`

### CI healing controls
- `CI_HEALING_ENABLED=true`
- `CI_HEALING_MAX_ATTEMPTS=3`
- `CI_HEALING_SAFE_MODE=true`
- `CI_HEALING_WEBHOOK_SECRET=` (optional but strongly recommended)
- `CI_HEALING_AI_PROVIDER=anthropic` (or `openai`, `gemini`, `grok`)

### Slack notifications
- `CI_HEALING_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...`

### AI provider secrets (choose one path)
- Anthropic:
  - `ANTHROPIC_API_KEY=...`
  - `CLAUDE_DEFAULT_MODEL=claude-sonnet-4-20250514`
- OpenAI-compatible (OpenAI / Gemini / Grok gateways):
  - `OPENAI_API_KEY=...`
  - `OPENAI_BASE_URL=` (set for non-OpenAI endpoints)
  - `OPENAI_DEFAULT_MODEL=` / `GEMINI_DEFAULT_MODEL=` / `GROK_DEFAULT_MODEL=`

### PR automation (optional)
- `CI_HEALING_GITHUB_ENABLED=true`
- `GITHUB_TOKEN=...`
- `GITHUB_BASE_BRANCH=main`

### 🔒 Container-first validation gate (new)
This prevents PR creation unless container validation succeeds.
- `CI_HEALING_CONTAINER_VALIDATION_REQUIRED=true`
- `CI_HEALING_CONTAINER_VALIDATE_COMMAND=bash scripts/ci-healing-container-validate.sh`
- `CI_HEALING_CONTAINER_VALIDATE_TIMEOUT_MS=900000`
- `CI_HEALING_CONTAINER_VALIDATE_WORKDIR=/absolute/path/to/ci-fix-pilot/backend-coe/nestjs`

The wrapper script is located at:
- `backend-coe/nestjs/scripts/ci-healing-container-validate.sh`

Optional overrides supported by the wrapper:
- `CI_HEALING_CONTAINER_COMPOSE_FILE`
- `CI_HEALING_CONTAINER_BACKEND_ENV_FILE`
- `CI_HEALING_CONTAINER_HEALTH_URL`
- `CI_HEALING_CONTAINER_PROJECT_NAME`
- `CI_HEALING_CONTAINER_HEALTH_RETRIES`
- `CI_HEALING_CONTAINER_HEALTH_SLEEP_SECONDS`

If `CI_HEALING_CONTAINER_VALIDATION_REQUIRED=true` and command is missing/fails, run attempt is marked failed and **no PR is raised**.

## 2) Frontend required envs (`frontend-coe/.env`)

- `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3002/v1`
- `NEXT_PUBLIC_APP_URL=http://localhost:3001`
- `NEXT_PUBLIC_APP_ENV=development`
- `NEXT_PUBLIC_APP_TITLE=Create Next CoE`
- `NEXT_PUBLIC_APP_NAME=Create Next CoE`
- `NEXT_PUBLIC_APP_DESCRIPTION=Production-ready Next.js starter`
- `NEXT_PUBLIC_APP_CATEGORY=app`
- `NEXT_PUBLIC_APP_KEYWORDS=nextjs,starter,boilerplate`
- `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`
- `NEXT_PUBLIC_POSTHOG_INGEST=/ingest`
- `NEXT_PUBLIC_POSTHOG_ENVIRONMENT=development`
- `DB_DIALECT=sqlite`
- `DATABASE_URL=file:./create-next-coe.db`
- `NODE_ENV=development`

## 3) Monitoring stack (Prometheus + Grafana)

Backend already exposes metrics at:
- `GET /metrics`

Run monitoring stack from backend folder:
- `cd backend-coe/nestjs`
- `docker compose up -d prometheus grafana node-exporter loki promtail`

Open:
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (or configured `GRAFANA_PORT`)

Import dashboard JSON:
- `backend-coe/nestjs/apm/grafana.json`

CI-healing specific panels now included:
- Webhook rate
- Attempts success/failure rate
- Run status transitions
- Container validation pass rate
- PR action rates
- Human action rates

## 4) Quick debugging checklist

1. `curl http://localhost:3002/health`
2. `curl http://localhost:3002/metrics | grep ci_healing`
3. Trigger webhook:
   - `POST /v1/ci-healing/webhook`
4. Check run:
   - `GET /v1/ci-healing/runs`
   - `GET /v1/ci-healing/runs/:id`
5. If run stays queued:
   - ensure worker is running
   - ensure Redis reachable
6. If run fails before PR:
   - inspect `attempts[].validationLog`
   - confirm `CI_HEALING_CONTAINER_VALIDATE_COMMAND` succeeds manually
7. Slack not firing:
   - verify `CI_HEALING_SLACK_WEBHOOK_URL`
   - check backend logs for webhook POST failures
