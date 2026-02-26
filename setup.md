# Setup Guide (From Remote Git Repo)

This document covers first-time local setup for **ci-fix-pilot** from GitHub.

---

## 1) Prerequisites

Install these tools first:

- Git
- Node.js **22.x** (recommended)
- pnpm (use Corepack; see below)
- Docker Desktop (for PostgreSQL + Redis)

> Backend and frontend both support Node >=20, but this repo has been tested with Node 22.

---

## 2) Clone the Repository

### HTTPS

```bash
git clone https://github.com/charan-happy/ci-fix-pilot.git
cd ci-fix-pilot
```

### SSH (optional)

```bash
git clone git@github.com:charan-happy/ci-fix-pilot.git
cd ci-fix-pilot
```

---

## 3) Enable pnpm via Corepack

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

---

## 4) Backend Setup (NestJS)

```bash
cd backend-coe/nestjs
pnpm install --no-frozen-lockfile
```

Create environment file:

```bash
cp .env.example .env
```

Start local infrastructure (Postgres + Redis):

```bash
pnpm run db:dev:up
```

Run database migrations:

```bash
pnpm run db:migrate
```

Start backend API and worker (dev mode):

```bash
pnpm run start:dev
```

Backend should be available at:

- API health: http://localhost:3002/health

---

## 5) Frontend Setup (Next.js)

Open a new terminal:

```bash
cd ci-fix-pilot/frontend-coe
pnpm install --frozen-lockfile
```

Create frontend env file:

```bash
cp .env.example .env
```

Run frontend dev server:

```bash
pnpm dev
```

Frontend should be available at:

- App: http://localhost:3000

---

## 6) Quick Validation

### Backend checks

```bash
cd ci-fix-pilot/backend-coe/nestjs
pnpm run type-check
curl -sS http://localhost:3002/health
```

### Frontend checks

```bash
cd ci-fix-pilot/frontend-coe
pnpm run type:check
```

---

## 7) Optional: CI-Healing Configuration

If you want full self-healing CI behavior (webhook + Slack + PR automation), configure env/secrets as documented in:

- `ENV_SETUP_CIHEALING.md`
- `README.md`

---

## 8) Common Troubleshooting

### Port already in use

- Backend default port is `3002`
- Frontend default port is `3000`

Stop old processes and restart.

### Docker services not running

```bash
cd ci-fix-pilot/backend-coe/nestjs
docker compose ps
pnpm run db:dev:up
```

### Fresh reinstall

Backend:

```bash
cd ci-fix-pilot/backend-coe/nestjs
rm -rf node_modules
pnpm install --no-frozen-lockfile
```

Frontend:

```bash
cd ci-fix-pilot/frontend-coe
rm -rf node_modules
pnpm install --frozen-lockfile
```

---

## 9) Stop Local Stack

Backend infra:

```bash
cd ci-fix-pilot/backend-coe/nestjs
pnpm run db:dev:rm
```

Stop dev servers with `Ctrl + C` in each terminal.
