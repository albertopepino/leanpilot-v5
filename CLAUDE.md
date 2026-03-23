# LeanPilot v4 — Project Instructions

> "Democratize Lean Management for every factory, every team, every person."

## Product Vision

LeanPilot is a web application that makes Lean Manufacturing accessible to **beginners and advanced users**. It replaces whiteboards, Excel sheets, and tribal knowledge with a clean, guided digital experience.

**Domain**: leanpilot.me

## Hierarchy

```
Corporate (HQ / Group level)
  └── Site (Factory / Plant / Warehouse)
       └── User (with role-based access)
```

- **Corporate Admin** — sees all sites, manages site admins, views consolidated KPIs
- **Site Admin** — manages users within their site, configures lean tools
- **Manager** — runs lean activities, reviews data, approves suggestions
- **Operator** — participates in audits, submits Kaizen ideas, views boards
- **Viewer** — read-only access to dashboards and reports

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Monorepo** | npm workspaces | Single repo, shared types, one `npm run dev` |
| **Frontend** | Next.js 15 (App Router) + React 19 + TypeScript | SSR, file-based routing, latest React |
| **UI** | Tailwind CSS + shadcn/ui | Consistent, accessible, dark mode built-in |
| **Backend** | NestJS + TypeScript | Modular monolith, decorators, DI, guards |
| **ORM** | Prisma | Type-safe queries, migrations, studio |
| **Database** | PostgreSQL 16 | Multi-tenant via `site_id` column |
| **Auth** | Built-in JWT + bcrypt | No Keycloak. Simple role GUI in the app |
| **i18n** | next-intl (frontend) | Start EN + IT, add langs when needed |
| **Deploy** | Docker Compose → Hetzner VPS | Simple, cheap, EU data residency |
| **CI/CD** | GitHub Actions | Lint, test, build, deploy on push to main |

## Architecture Principles

1. **Start simple** — No Redis, no message queues, no S3 until proven necessary
2. **Modular monolith** — Each lean tool is a NestJS module with clear boundaries
3. **One DB, partitioned by site_id** — No schema-per-tenant complexity
4. **Progressive disclosure** — Beginners see guided flows; advanced users toggle "expert mode"
5. **Mobile-first** — Operators use phones/tablets on the shop floor
6. **Lean about being lean** — No feature gets built unless there's a pull for it

## Always-Enabled Skills

These skills are ALWAYS active. Apply them automatically — never wait for slash commands:

### /frontend-dev
Senior Frontend Engineer (15+ years). Production-grade React/TypeScript. Accessibility (ARIA, keyboard nav). Performance (lazy loading, memoization). Mobile-first Tailwind. shadcn/ui components. Proper error/loading/empty states.

### /backend-master
NestJS expert. Modular architecture with clear module boundaries. Prisma for type-safe DB access. JWT guards with role-based access. DTOs with class-validator. Proper error handling with NestJS exception filters. Async everywhere.

### /full-stack-lean
End-to-end feature validation: Component → API → Database. Ensure both technical correctness AND lean methodology accuracy. Every feature must make sense on a real shop floor.

### /lean-master
Lean Six Sigma Black Belt consultant. TPS, JIT, Jidoka, VSM, 5S/6S, OEE, TPM, SMED, Kaizen, A3, DMAIC, Poka-Yoke, Andon, Heijunka, Hoshin Kanri. Industry 4.0/5.0 integration. ISO/IATF alignment.

### /lean-review
Review every feature through a Lean lens: Is the methodology correct? Would this work on a real shop floor? Does it follow ISO/IATF standards? Is it accessible to a beginner while useful to an expert?

### /coderabbit:code-review
Automated code review on every significant change. Check for bugs, security, performance, code quality, and adherence to project conventions.

## File Structure

```
leanpilot-v4/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   │   ├── (auth)/     # Login, register, forgot-password
│   │   │   │   ├── (dashboard)/ # Authenticated pages
│   │   │   │   │   ├── corporate/   # Corporate-level views
│   │   │   │   │   ├── site/        # Site-level views
│   │   │   │   │   ├── tools/       # Lean tool pages
│   │   │   │   │   ├── admin/       # User & role management
│   │   │   │   │   └── settings/    # User preferences
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn/ui base components
│   │   │   │   ├── layout/     # Shell, sidebar, header
│   │   │   │   ├── dashboard/  # KPI cards, charts
│   │   │   │   ├── admin/      # User management
│   │   │   │   └── tools/      # Lean tool components
│   │   │   ├── lib/            # API client, utils, constants
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   └── stores/         # Zustand (only if needed)
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── main.ts
│       │   ├── auth/           # JWT, login, register, guards
│       │   ├── users/          # User CRUD, role assignment
│       │   ├── sites/          # Site management
│       │   ├── corporate/      # Corporate-level aggregation
│       │   ├── dashboard/      # KPI endpoints
│       │   ├── tools/          # Lean tool modules (added incrementally)
│       │   │   ├── five-s/
│       │   │   ├── kaizen/
│       │   │   ├── gemba/
│       │   │   └── ... (added as needed)
│       │   ├── common/         # Guards, decorators, filters, pipes
│       │   └── prisma/         # Prisma service & module
│       ├── prisma/
│       │   └── schema.prisma
│       ├── test/
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared TypeScript types & constants
│       ├── src/
│       │   ├── types/          # Role, User, Site, Tool types
│       │   └── constants/      # Lean terminology, enums
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── Dockerfile.api / Dockerfile.web
│
├── scripts/
│   ├── setup-github-ssh.sh
│   └── deploy.sh
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── .env.example
├── .gitignore
├── package.json               # Root workspace config
├── tsconfig.base.json         # Shared TS config
├── CLAUDE.md                  # This file
└── README.md
```

## Key Conventions

- **API Client**: Frontend uses a typed API client in `web/src/lib/api.ts` wrapping fetch
- **Auth Guard**: Backend uses `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` decorators
- **Multi-tenant**: Every query filters by `siteId`. Corporate endpoints aggregate across sites
- **Theme**: Tailwind dark mode via `class` strategy. Use shadcn/ui theming system
- **No dead code**: If it's not used, delete it. No commented-out blocks.
- **No over-engineering**: Minimum viable solution first. Refactor when complexity is earned.

## Phase 1 Scope (MVP for Demo)

1. **Auth**: Login, register (invite-only), JWT tokens, role-based access
2. **Admin Panel**: User list, create/edit user, assign role + site
3. **Corporate Dashboard**: Site overview cards, basic KPIs per site
4. **Site Dashboard**: Main workspace — link to available lean tools
5. **5S Audit Tool**: Score-based audit with photos, history, trend chart
6. **Kaizen Board**: Submit idea → Review → Approve → Implement → Verify

That's it. Six features. Clean, working, demo-ready.
