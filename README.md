# ProxiFix

ProxiFix is a web-first service marketplace for coordinating local repair work between clients, verified workers, and platform administrators. It combines a polished Vue interface with a Cloudflare Worker API, PostgreSQL-backed persistence, role-aware dashboards, real-time messaging flows, and production-oriented operational safeguards.

The project is designed around a practical home-service workflow: clients post jobs, workers review leads and send offers, both sides coordinate through messages, and admins keep verification and trust workflows under control.

## Highlights

- Client workspace for posting jobs, tracking offers, saving workers, managing hires, and reviewing service history.
- Worker workspace for lead discovery, offer management, hire requests, job history, and client conversations.
- Admin workspace for user oversight, worker verification, reports, and platform operations.
- Password and Google OAuth entry points with role-aware routing.
- Offer lifecycle support from worker quote submission through client acceptance.
- Conversation threads tied to service requests, with message persistence and unsend paths.
- Location privacy states for approximate sharing, exact-location requests, and controlled disclosure.
- Production hardening with request IDs, structured logs, rate limits, idempotent message writes, and smoke checks.

## Tech Stack

- **Frontend:** Vue 3, Vue Router, Pinia, TypeScript, Vite
- **UI:** Tailwind CSS, Lucide Vue icons, custom responsive layouts
- **Backend:** Cloudflare Workers, Hono, Zod
- **Database:** PostgreSQL with Drizzle ORM
- **Cloud infrastructure:** Cloudflare Pages, Workers, Hyperdrive, Wrangler
- **Maps:** Leaflet
- **Verification:** TypeScript checks, Vite build, live regression scripts, smoke tests

## Repository Layout

```text
.
|-- src/                    # Vue application
|   |-- components/          # Shared and layout components
|   |-- composables/         # Client-side data and messaging helpers
|   |-- stores/              # Pinia state modules
|   `-- views/               # Public, client, worker, and admin screens
|-- worker/                 # Cloudflare Worker API
|   `-- src/
|       |-- lib/             # Auth, database, sessions, logging, guards
|       |-- routes/          # API route modules
|       `-- db/              # Drizzle schema
|-- supabase/               # Local Supabase config and migrations
|-- scripts/                # Verification, smoke, and deployment helpers
|-- wrangler.worker.jsonc   # Worker deployment config
|-- wrangler.pages.jsonc    # Pages deployment config
`-- .dev.vars.example       # Local development environment template
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL database
- Cloudflare account for Worker/Pages deployment
- Google OAuth client ID if using Google sign-in

### Install

```bash
npm install
```

### Configure Environment

Copy the example file and fill in local values:

```bash
cp .dev.vars.example .dev.vars
```

Required local variables:

```text
APP_NAME=ProxiFix
APP_ORIGIN=http://localhost:5173
DATABASE_URL=postgres://...
GOOGLE_CLIENT_ID=...
JWT_SECRET=...
ADMIN_EMAIL_ALLOWLIST=...
SEED_TOKEN=...
```

Do not commit `.dev.vars`, `.env`, database passwords, OAuth secrets, API keys, or generated Cloudflare state. Runtime secrets should be stored through Wrangler or the target platform secret manager.

### Run the Frontend

```bash
npm run dev
```

### Run the Worker Locally

```bash
npm run cf:dev
```

The frontend defaults to Vite, while the Worker runs from `worker/src/index.ts` through Wrangler.

## Scripts

```bash
npm run dev              # Start the Vue development server
npm run build            # Type-check and build the frontend
npm run preview          # Preview the production frontend build
npm run typecheck        # Run Vue TypeScript checks
npm run cf:dev           # Run the Cloudflare Worker locally
npm run cf:deploy        # Deploy the Worker
npm run cf:pages:deploy  # Deploy the built frontend to Cloudflare Pages
npm run cf:types         # Generate Cloudflare Worker types
npm run db:generate      # Generate Drizzle migrations
npm run db:push          # Push schema changes
npm run verify:live      # Run live regression checks
npm run verify:smoke:prod # Run production smoke checks
```

## Deployment Notes

The public repository intentionally does not contain production secrets. Configure these outside Git:

- `DATABASE_URL`
- `JWT_SECRET`
- `SEED_TOKEN`
- provider-specific secrets such as email, SMS, OAuth, or storage credentials

For Cloudflare Workers, use:

```bash
npx wrangler secret put DATABASE_URL --config wrangler.worker.jsonc
npx wrangler secret put JWT_SECRET --config wrangler.worker.jsonc
npx wrangler secret put SEED_TOKEN --config wrangler.worker.jsonc
```

The Worker can also use the `PROXIFIX_DB` Hyperdrive binding declared in `wrangler.worker.jsonc`. Keep actual connection strings in Cloudflare configuration or local development files, not in source control.

## Security Posture

ProxiFix includes several production-oriented controls:

- Deny-by-default route guards for authenticated and role-specific API routes.
- Hashed password credentials and hashed session tokens.
- Request-scoped logging with `x-request-id` propagation.
- Rate limits for auth, offer, concern, and message write paths.
- Message idempotency keys to prevent duplicate writes during retries.
- Explicit location privacy states for client address disclosure.
- Secret handling through environment variables and Wrangler secrets.

Operational guidance should stay aligned with the deployed environment, especially secret rotation, alert routing, and rollback steps.

## Public Repo Safety

This repository was published from a fresh sanitized history. Local development files, dependencies, build artifacts, Wrangler cache files, and private environment files are intentionally excluded.

Before pushing future changes, check for accidental secrets:

```bash
git status --short
git diff --cached
```

Recommended additional checks:

```bash
rg -n --hidden -g '!node_modules/**' -g '!dist/**' -g '!.git/**' \
  'DATABASE_URL|JWT_SECRET|SEED_TOKEN|client_secret|service_role|private_key|postgresql://'
```

## Project Status

ProxiFix is an active product prototype with end-to-end flows for client, worker, and admin users. It is suitable for continued development, product demos, Cloudflare deployment experiments, and marketplace workflow validation.

## License

No license has been declared yet. Add a license before accepting external contributions or reusing this project in another context.
