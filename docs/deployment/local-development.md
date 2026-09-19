# Local development

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 11 (`corepack enable` picks up the `packageManager` field)
- Docker Desktop (or another Docker Engine with Compose v2+)

## First-time setup

```bash
pnpm install          # installs dependencies, sets up Husky hooks, generates the Prisma client
pnpm infra:up         # starts PostgreSQL and Maildev
```

Create `apps/api/.env` (never commit it):

```dotenv
NODE_ENV=development
PORT=4001

# Matches the Postgres service in docker-compose.yml
DATABASE_URL=postgresql://languze:languze@localhost:5435/languze

# Browser origin allowed by CORS (apps/web dev server)
WEB_ORIGIN=http://localhost:3003

# Usage limits (SRS FR-081) and the general rate limit, per minute
WORLD_LIMIT=20
DAILY_ANALYSIS_LIMIT=10
DAILY_TUTOR_MESSAGE_LIMIT=30
RATE_LIMIT_PER_MINUTE=120
```

Only `DATABASE_URL` is required; the other values above are the defaults. The API validates these variables at startup and refuses to start if any are invalid.

Then start both apps:

```bash
pnpm dev
```

## Services and ports

| Service                  | URL / port                 | Notes                                     |
| ------------------------ | -------------------------- | ----------------------------------------- |
| Web (Next.js)            | http://localhost:3003      |                                           |
| API (NestJS)             | http://localhost:4001      | `GET /health` checks the API and database |
| API docs (Swagger)       | http://localhost:4001/docs | Disabled when `NODE_ENV=production`       |
| PostgreSQL 18 + pgvector | `localhost:5435`           | user/password/db: `languze` (local only)  |
| Maildev SMTP             | `localhost:1026`           | Captures outgoing email                   |
| Maildev inbox            | http://localhost:1081      |                                           |

Host ports can be changed with `POSTGRES_PORT`, `MAILDEV_SMTP_PORT`, and `MAILDEV_WEB_PORT` when running `docker compose`.

## Everyday commands

Run from the repository root.

| Command                                         | Purpose                                             |
| ----------------------------------------------- | --------------------------------------------------- |
| `pnpm dev`                                      | Web + API in watch mode                             |
| `pnpm lint` / `pnpm typecheck`                  | ESLint / TypeScript in every app                    |
| `pnpm test`                                     | Unit and component tests (no database needed)       |
| `pnpm test:e2e`                                 | API e2e tests (needs PostgreSQL and `DATABASE_URL`) |
| `pnpm build`                                    | Production builds                                   |
| `pnpm format` / `pnpm format:check`             | Prettier                                            |
| `pnpm infra:up` / `pnpm infra:down`             | Start / stop local infrastructure                   |
| `pnpm --filter @languze/api prisma:migrate`     | Create and apply a migration (`prisma migrate dev`) |
| `pnpm --filter @languze/api exec prisma studio` | Browse data                                         |

Commits run Husky's pre-commit hook: ESLint (per app) and Prettier on staged files only.

## Calling the API by hand

- LanguZe endpoints are under `/v1`; `/health` and `/docs` are at the root.
- Every response has an `X-Request-Id` header. Error responses and log lines carry the same ID, so an error can be found in the logs.
- Requests that change data (`POST`, `PUT`, `PATCH`, `DELETE`) are refused with `ORIGIN_NOT_ALLOWED` unless they send the web app's origin, for example `-H "Origin: http://localhost:3003"` with curl. This also applies to "Try it out" in the Swagger page, which runs on the API's own origin.

## Troubleshooting

- **Prisma suggests `npm i prisma@latest`.** Ignore it: `latest` is currently a Prisma 8 release candidate. See ADR-0002.
- **pnpm reports a `minimumReleaseAge` violation or adds `minimumReleaseAgeExclude` entries.** A dependency resolved to a release newer than about one day. Prefer an older patch in the version range over keeping the exclude entry.
- **`Invalid environment variables: DATABASE_URL` on API start.** `apps/api/.env` is missing or the URL is not a `postgres://`/`postgresql://` URL.
- **`/health` returns 503.** The API is running but cannot reach PostgreSQL; check `pnpm infra:up` and `docker compose ps`.
- **Reset the local database.** `docker compose down -v` deletes the `postgres-data` volume (all local data), then `pnpm infra:up`.
