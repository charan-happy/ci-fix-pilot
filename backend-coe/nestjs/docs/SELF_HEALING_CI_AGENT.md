# Self-Healing CI Agent (Track 5/6) — Implementation Spec

## Scope (24-hour build, demo-ready)

This implementation adds a production-style MVP for a **Self-Healing CI agent** using the existing NestJS + BullMQ + AI foundations.

Included in this phase:

1. Inbound CI failure webhook endpoint (GitHub-style payload subset)
2. Deduplicated queue job creation per `repo + commit + errorHash`
3. Three-attempt retry workflow (`maxRetries = 3`)
4. AI-driven diagnosis/fix suggestion via existing `AiService`
5. Safe mode execution (no direct code push by default; creates proposed patch and metadata)
6. Escalation record when all attempts fail
7. Slack notification hooks (best-effort, webhook URL if configured)
8. Read APIs for dashboard: run list, run detail, attempts summary
9. Frontend dashboard page showing runs, status, attempts, and escalation

## Scope (v2 extension in progress)

This extension makes the system closer to a real end-to-end demo for hackathon judging:

1. Real GitHub PR creation from agent proposals (optional via env)
2. Human-in-the-loop run actions: approve (merge), deny (close PR), abort (stop run)
3. Timeline/event stream for each run (agent thinking + status transitions)
4. Multi-repo metrics and AI success-rate tracking
5. Dashboard controls for run actions and repository-level visibility
6. AI provider routing for Claude/OpenAI-compatible backends (Gemini/Grok via compatibility mode)

Out of scope for this phase:

- Direct git write/branch/PR creation in production repos (requires secrets and repo-level permissions)
- Multi-provider RAG memory persistence for fix embeddings
- Full cross-repo policy engine

## Non-Functional Goals

- Cloud agnostic: no AWS-specific implementation
- CI tool agnostic: webhook payload normalized into internal event model
- Secure defaults: signed webhook option + masked logs + no code mutation without explicit enablement
- Reliable processing: BullMQ retries and idempotency hash
- Scalable: queue-based async processing and paginated read APIs

## Backend Design

### New Domain Module

`src/ci-healing/`

- `ci-healing.module.ts`
- `ci-healing.controller.ts`
- `ci-healing.service.ts`
- `ci-healing.processor.ts`
- `ci-healing.queue.ts`
- `dto/`
- `interfaces/`

### Queue Flow

1. `POST /api/v1/ci-healing/webhook` accepts normalized payload
2. Compute `errorHash` from failure signature
3. Upsert/insert `ci_healing_runs` record with `QUEUED`
4. Enqueue `CI_HEALING_PROCESS` job with run id
5. Worker processes attempt:
   - mark attempt as `RUNNING`
   - ask AI for root cause + proposed fix
   - store proposal and summary
   - mark `SUCCEEDED` if confidence threshold met; else `RETRY_PENDING`
6. If retries exhausted, mark run `ESCALATED`

### Data Model (Drizzle)

#### Table: `ci_healing_runs`
- `id` uuid pk
- `repo` text
- `branch` text
- `commit_sha` text
- `provider` text (github/gitlab/jenkins/generic)
- `error_hash` text
- `error_summary` text
- `status` enum (`queued`, `running`, `fixed`, `escalated`, `aborted`, `resolved`)
- `attempt_count` int default 0
- `max_attempts` int default 3
- `pr_url` text nullable
- `escalation_reason` text nullable
- `created_at`, `updated_at`

Unique index: `(repo, commit_sha, error_hash)` for dedupe.

#### Table: `ci_healing_attempts`
- `id` uuid pk
- `run_id` uuid fk -> `ci_healing_runs.id`
- `attempt_no` int
- `status` enum (`running`, `failed`, `succeeded`)
- `diagnosis` text
- `proposed_fix` text
- `validation_log` text
- `failure_reason` text nullable
- `created_at`

## API Contracts

### Inbound

`POST /api/v1/ci-healing/webhook`

Request (normalized):

```json
{
  "provider": "github",
  "repository": "owner/repo",
  "branch": "main",
  "commitSha": "abc123",
  "pipelineUrl": "https://...",
  "errorLog": "TS2339: Property ...",
  "errorType": "type_error"
}
```

Response:

```json
{
  "runId": "uuid",
  "status": "queued",
  "deduplicated": false
}
```

### Dashboard APIs

- `GET /api/v1/ci-healing/runs?page=1&pageSize=20&status=queued`
- `GET /api/v1/ci-healing/runs/:id`
- `GET /api/v1/ci-healing/metrics/summary`

### Dashboard APIs (v2)

- `GET /api/v1/ci-healing/runs?page=1&pageSize=20&status=queued&repository=owner/repo`
- `GET /api/v1/ci-healing/runs/:id` (includes attempts + events)
- `GET /api/v1/ci-healing/metrics/summary` (includes success rate)
- `GET /api/v1/ci-healing/metrics/repositories`
- `POST /api/v1/ci-healing/runs/:id/actions/approve`
- `POST /api/v1/ci-healing/runs/:id/actions/deny`
- `POST /api/v1/ci-healing/runs/:id/actions/abort`
- `POST /api/v1/ci-healing/runs/:id/actions/human-fix`

## Security

- Optional shared secret validation for inbound webhook (`CI_HEALING_WEBHOOK_SECRET`)
- PII-safe logging (truncate long logs)
- No auto-merge behavior
- Safe mode default (`CI_HEALING_SAFE_MODE=true`)

## Frontend Design

### New route

`src/app/(public)/ci-healing/page.tsx`

### UI sections

1. Summary cards: queued/running/fixed/escalated
2. Runs table: repo, commit, status, attempts, updated at
3. Run details panel: error summary, attempt timeline, proposed fix preview

### Frontend data path

Server component fetches backend endpoints using `fetch` with env-configured base URL.

## Environment Variables

- `CI_HEALING_ENABLED=true`
- `CI_HEALING_MAX_ATTEMPTS=3`
- `CI_HEALING_SAFE_MODE=true`
- `CI_HEALING_WEBHOOK_SECRET=`
- `CI_HEALING_SLACK_WEBHOOK_URL=`

### Environment Variables (v2)

- `CI_HEALING_GITHUB_ENABLED=true`
- `GITHUB_TOKEN=`
- `GITHUB_BASE_BRANCH=main`
- `CI_HEALING_AI_PROVIDER=anthropic` (`anthropic` | `openai` | `gemini` | `grok`)
- `GEMINI_DEFAULT_MODEL=`
- `GROK_DEFAULT_MODEL=`
- `OPENAI_BASE_URL=` (used for OpenAI-compatible providers)

## Validation Plan

1. Unit test `errorHash` normalization + dedupe check
2. Unit test retry transitions (`queued -> running -> retry -> escalated`)
3. API test webhook ingestion and list/detail endpoints
4. Frontend smoke test route render with mock API response

### Validation Plan (v2)

5. GitHub dry-run PR creation validation in test repository
6. Action flow validation: approve/deny/abort + status transitions
7. Event stream validation: webhook → attempts → PR action timeline
8. Multi-repo metric checks with seeded runs

## Containerized Integration

Use workspace root compose file:

- `docker-compose.integration.yml`

Primary docs:

- `INTEGRATION_TESTING.md`

## Budget & Feasibility Notes

For a 24-hour demo with $50–$60/month budget:

- Use existing stack and free tiers where possible
- Keep AI calls bounded (max attempts 3 + truncated logs)
- Run on one small app host + managed/free Postgres + Redis
- Keep multi-cloud compatibility by externalizing base URLs and credentials
