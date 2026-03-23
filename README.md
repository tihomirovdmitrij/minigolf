# Base Putt

Arcade mini-golf web app built with Next.js, wagmi, and viem for the Base App standard web strategy.

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL (optional for local persistence; without it, the app uses in-memory fallback)
- [Vercel](https://vercel.com/) account for deployment (optional)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill values:

```bash
cp .env.example .env.local
```

3. If using a local database, run migrations:

```bash
npm run db:generate
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

## Auth and wallet strategy

- Wallet connectivity is handled through wagmi connectors.
- Authentication uses SIWE (Sign-In with Ethereum) via the `/api/auth` endpoint.
- User identity in app flows is wallet-based (with development fallbacks when running locally).

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Set production env vars (`NEXT_PUBLIC_PROJECT_NAME`, `NEXT_PUBLIC_URL`, database/payment vars) in your hosting platform.

## Base App migration notes

This app has been migrated away from Farcaster miniapp runtime coupling:

- No Farcaster manifest route
- No `fc:frame` metadata in app layout
- No `@farcaster/*` runtime/auth dependencies

Reference migration guide:

- [Migrate to a Standard Web App](https://docs.base.org/mini-apps/quickstart/migrate-to-standard-web-app)
