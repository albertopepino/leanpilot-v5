# LeanPilot v4

**Democratize Lean Management for every factory, every team, every person.**

## Quick Start

```bash
# 1. Start PostgreSQL
cd docker && docker compose up -d && cd ..

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env

# 4. Run database migrations
npm run db:migrate

# 5. Seed demo data
npm run db:seed

# 6. Start development
npm run dev:api   # NestJS on :3001
npm run dev:web   # Next.js on :3000
```

## Demo Accounts

All passwords: `password123`

| Email | Role |
|-------|------|
| admin@leanpilot.me | Corporate Admin |
| site.admin@leanpilot.me | Site Admin |
| manager@leanpilot.me | Manager |
| operator@leanpilot.me | Operator |
| viewer@leanpilot.me | Viewer |

## Stack

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **Backend**: NestJS + Prisma + PostgreSQL
- **Auth**: JWT + bcrypt (built-in, no Keycloak)
- **Deploy**: Docker Compose + Caddy on Hetzner

## Architecture

```
Corporate (multi-site HQ)
  └── Site (factory/plant)
       └── User (role-based: admin, manager, operator, viewer)
```

## API Docs

Swagger UI available at `http://localhost:3001/api/docs` in development.
