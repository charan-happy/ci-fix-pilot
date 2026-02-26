# HealOps AWS Deployment (Cloud-Agnostic-Friendly Baseline)

## Priority Note

Cloud deployment is intentionally secondary; this document is for final rollout after local end-to-end validation.

## Recommended AWS Architecture

- **Compute**: ECS Fargate (backend API, backend worker, frontend)
- **Database**: Amazon RDS PostgreSQL
- **Queue/Cache**: Amazon ElastiCache Redis
- **Secrets**: AWS Secrets Manager + SSM Parameter Store
- **Container Registry**: Amazon ECR
- **Ingress**: Application Load Balancer (ALB)
- **Observability**: CloudWatch Logs + optional Grafana Cloud/Prometheus remote write

## Services

1. `healops-backend-api`
2. `healops-backend-worker`
3. `healops-frontend`

## Deployment Steps

### 1) Build & Push Images

- Build backend image from `backend-coe/nestjs/Dockerfile`
- Build frontend image from `frontend-coe/Dockerfile`
- Push to ECR repositories

### 2) Provision Data Layer

- Create RDS PostgreSQL (small instance for demo)
- Create ElastiCache Redis
- Store connection strings/secrets in Secrets Manager

### 3) Configure ECS Task Definitions

Backend API/Worker env vars:
- DB + Redis connection vars
- AI provider vars (`CI_HEALING_AI_PROVIDER`, provider keys)
- GitHub vars (`CI_HEALING_GITHUB_ENABLED`, `GITHUB_TOKEN`)
- Slack webhook var

Frontend env vars:
- `NEXT_PUBLIC_BACKEND_API_URL` pointing to ALB backend path

### 4) Run Migrations

One-time ECS task:

```bash
node dist/db/drizzle/migrate.js
```

### 5) Networking

- Place ECS services in private subnets
- Expose only ALB publicly
- Restrict DB/Redis security groups to ECS service SG

### 6) DNS & TLS

- Use Route53 record to ALB
- TLS via ACM certificate on ALB listener

## Cost-Aware Demo Setup (~$50–$60 target)

- Use smallest Fargate tasks for backend/worker/frontend
- Use burstable/small RDS + small Redis node
- Turn off non-critical monitoring services for demo
- Keep log retention short during hackathon window

## CI/CD Outline (Tool Agnostic)

Any CI can follow:
1. lint + typecheck + tests
2. build images
3. push to registry
4. deploy task definition revisions
5. run DB migrations
6. smoke test endpoints

## Smoke Tests Post Deploy

1. `GET /health`
2. `POST /v1/ci-healing/webhook`
3. Verify dashboard renders run
4. Verify PR action controls update backend state
