# HealOps Integration Testing Guide

## Goal

Run full-stack integration locally with Docker and validate webhook -> queue -> AI -> PR flow.

## Prerequisites

1. Create backend env from template:
   - `backend-coe/nestjs/.env`
2. Create frontend env from template:
   - `frontend-coe/.env`
3. Add required secrets:
   - AI keys (Anthropic/OpenAI-compatible)
   - Slack webhook URL
   - GitHub token (for real PR flow)

## Bring Up Stack

From workspace root:

```bash
docker compose -f docker-compose.integration.yml up --build
```

Frontend: `http://localhost:3001`
Backend API: `http://localhost:3000`

## Minimal Real-Flow Test

### 1) Trigger a CI failure run

```bash
curl -X POST http://localhost:3000/v1/ci-healing/webhook \
  -H "content-type: application/json" \
  -d '{
    "provider":"github",
    "repository":"charan-happy/ci-fix-pilot",
    "branch":"main",
    "commitSha":"demo-'"$(date +%s)'",
    "pipelineUrl":"https://github.com/charan-happy/ci-fix-pilot/actions",
    "errorType":"type_error",
    "errorLog":"TS2339: Property username does not exist on type CreateUserDto"
  }'
```

### 2) Check dashboard

Open `http://localhost:3001/ci-healing`.

Verify:
- run is visible
- attempts + timeline events are visible
- summary and repo metrics are populated

### 3) Validate action controls

From dashboard:
- Approve / Merge
- Deny
- Abort
- Mark Human Fixed

Verify status transitions and new timeline events after each action.

## Real PR Validation

Set:
- `CI_HEALING_GITHUB_ENABLED=true`
- `GITHUB_TOKEN=<token with repo write + pull_request permissions>`

Then trigger webhook again and verify:
- PR URL appears in dashboard
- PR state updates after Approve / Deny

## Troubleshooting

- If migrations fail, verify `DATABASE_URL` points to `postgres` host inside Docker network.
- If AI calls fail, validate provider/model envs.
- If PR creation fails, check token scopes and repository string format `owner/repo`.
