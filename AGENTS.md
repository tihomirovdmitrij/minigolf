# Base miniapp

Reusable across base miniapp projects. Copy to a new repo and adjust app name if needed.

## Project overview

- **Type:** Base miniapp (Next.js, App Router).
- **Target runtimes:** Production = base miniapp only. Dev/test = browser only. Do not optimize or document for other environments (e.g. standalone PWA, other embed targets).
- **Stack:** Next.js (App Router), TypeScript. If the app needs a DB → Drizzle as ORM; use **postgres** (the `postgres` npm package) as the PostgreSQL connector. For styles prefer Tailwind.

## Build & test commands

- Start dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type-check: `npx tsc --noEmit`

## Directory and module layout

**Frontend**

- `app/` — routes, `layout.tsx`, `page.tsx`, `loading.tsx`, etc.
- `app/components/` — reusable UI components; colocate `*.module.css` next to components.
- `app/providers/` — React context providers (e.g. miniapp SDK, auth).
- `app/(feature)/` — optional route groups; keep pages thin and delegate to components.

**Backend (when present)**

- `lib/` at repo root. Per-domain modules (e.g. `lib/auth/`, `lib/waitlist/`) with:
  - **Controller** — `*.controller.ts` (e.g. `auth.controller.ts`): HTTP/Next.js API surface only; parse request, call service, return response.
  - **Service** — `*.service.ts`: business logic only; no HTTP, no direct external I/O (use repositories).
  - **Repository** — `*.repository.ts`: all external I/O (DB via Drizzle, external APIs, etc.); used by services.
- One clear scope per module; keep modules compact.
- API routes in `app/api/**/route.ts` delegate to controllers (thin handlers); no business or external I/O in route files.

**Shared**

- `lib/db/` — Drizzle schema, client (using **postgres** as the PostgreSQL connector), and migrations when DB is used.
- Config at root: e.g. `farcaster.config.ts`; env via `.env.local`; copy from `.env.example`.

## Backend conventions

- Backend lives under `lib/` only. Use file suffixes: `*.controller.ts`, `*.service.ts`, `*.repository.ts`.
- **Controller:** Validate input (body/query), call service, map to HTTP status + JSON; no business logic.
- **Service:** Orchestrate use cases; call service, repositories, or helpers; no `Request`/`Response`, no direct DB or HTTP to external systems.
- **Repository:** All external communication (DB via Drizzle, external APIs, etc.); accept/return domain-friendly types or IDs.
- One folder per bounded context; no god-modules.

## Frontend conventions

- Functional components and hooks; colocate styles with components (CSS modules).
- Prefer **Tailwind CSS** utility classes for layout, spacing, typography, and simple visual styles.
  - Use CSS Modules or global CSS only where Tailwind is a bad fit (complex SVG animations, keyframes, highly custom visuals).
- Single responsibility; small presentational components + containers/hooks where needed.
- Follow existing patterns in `app/components/` and `app/providers/`.

## Code style

- TypeScript strict; avoid `any`.
- Prefer explicit return types on public functions and API handlers.
- When adding DB, follow Drizzle best practices and existing schema style.

## Security and AI boundaries

- **ALWAYS:** Run type-check/lint and verify next build before committing; use env vars for secrets (never hardcode).
- **ASK before:** Changing auth or miniapp embedding flow; adding new dependencies; large refactors of layout or module boundaries.
- **NEVER:** Commit `.env` or secrets; put real values in `.env.example`; assume environments other than miniapp (prod) and browser only (dev/test).
