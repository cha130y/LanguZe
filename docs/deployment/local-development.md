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

# Sign-in (ADR-0003). Generate the secret yourself, for example:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
AUTH_SECRET=<32 characters or more>
AUTH_URL=http://localhost:4001

# Outgoing email; these defaults match Maildev in docker-compose.yml
MAIL_HOST=localhost
MAIL_PORT=1026
MAIL_FROM="LanguZe <no-reply@languze.local>"
```

Only `DATABASE_URL` and `AUTH_SECRET` are required; the other values above are the defaults. The API validates these variables at startup and refuses to start if any are invalid.

Three more variables exist for production and stay empty locally: `MAIL_USER` and `MAIL_PASSWORD`, because Maildev accepts anonymous mail, and `COOKIE_DOMAIN`, because the web app and the API already share `localhost`. See [production deployment](production.md). The provider credentials — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINE_CLIENT_ID` and `LINE_CLIENT_SECRET` — are covered under the two sign-in sections below. Each provider is offered only once both of its values are set, and the web app reads the list from `GET /v1/auth/providers`, so a button never appears for a provider the API cannot serve.

The web app needs no environment file locally: it calls `http://localhost:4001` unless `NEXT_PUBLIC_API_URL` says otherwise in `apps/web/.env.local`.

**Environment files are read once, at startup.** Watch mode restarts the API when source code changes, not when `.env` changes, so after editing either file stop `pnpm dev` and start it again. A setting that seems to be ignored almost always means this.

## Google sign-in

Optional: without credentials the API still starts, and simply does not offer Google.

1. In [Google Cloud Console](https://console.cloud.google.com), create a project named **LanguZe** — its own project, because the consent screen belongs to the project and learners would otherwise see another app's name
2. **APIs & Services → OAuth consent screen → Get started**: app name LanguZe, audience **External**, then under **Branding** add `languze.com` as an authorised domain
3. **Audience**: leave it in **Testing** and add your own Google account as a test user. Only listed test users can sign in, which is what development needs, and nothing has to be verified
4. **Data Access**: only `openid`, `userinfo.email`, and `userinfo.profile`
5. **Clients → Create client**, type **Web application**, with both redirect URIs:
   - `https://api.languze.com/auth/callback/google`
   - `http://localhost:4001/auth/callback/google`
6. Copy the secret straight away — it may not be shown again — and put both values in `apps/api/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

A `redirect_uri_mismatch` from Google means the URI above differs from the one registered, even by a trailing slash.

## LINE sign-in

Also optional. LINE Login needs one channel per country, and LanguZe uses a Thailand channel (ADR-0003).

1. In the [LINE Developers console](https://developers.line.biz/console/), sign in with the LINE account that will own the app and create a **provider** — LINE's word for the publisher shown to learners
2. Create a **LINE Login** channel: region **Thailand**, app type **Web app**, and the LanguZe name, description, and icon
3. Under **LINE Login → Callback URL**, add both, one per line:
   - `https://api.languze.com/auth/callback/line`
   - `http://localhost:4001/auth/callback/line`
4. Copy the **Channel ID** and **Channel secret** from the **Basic settings** tab into `apps/api/.env` as `LINE_CLIENT_ID` and `LINE_CLIENT_SECRET`
5. Add your own LINE account as a tester under **Roles** while the channel is in development

The **email permission** under **OIDC** is not needed and not requested. It takes LINE's approval and a screenshot of the consent screen, and LanguZe could not use the address anyway: LINE never states that one is verified, so FR-009 forbids it, and every LINE account is stored with a placeholder address (D1). The API asks LINE for `openid profile` only — the user ID and the display name — so an unapproved permission can never fail a sign-in.

## Testing through the tunnel

Sign-in has to be tried in real browsers on real subdomains — Safari, and the LINE and Facebook in-app browsers (NFR-018) — because the problems it guards against cannot appear on `localhost`. A Cloudflare Tunnel serves the local applications at `languze.com` and `api.languze.com` over HTTPS, reachable from a phone on any network.

The tunnel `languze-dev` is configured in `~/.cloudflared/config.yml`. Start it alongside the applications:

```bash
cloudflared tunnel run languze-dev
pnpm dev
```

While it runs, `languze.com` is public and anyone who finds it can sign up, so stop it when you are done. The `.env` files have to match how you are testing — mixing the two sends the provider callback somewhere the browser is not:

| Variable                        | Local only              | Through the tunnel        |
| ------------------------------- | ----------------------- | ------------------------- |
| `WEB_ORIGIN`                    | `http://localhost:3003` | `https://languze.com`     |
| `AUTH_URL`                      | `http://localhost:4001` | `https://api.languze.com` |
| `COOKIE_DOMAIN`                 | _(empty)_               | `.languze.com`            |
| `NEXT_PUBLIC_API_URL` (web app) | `http://localhost:4001` | `https://api.languze.com` |

Both provider callback URLs have to be registered for both addresses, which step 5 above and step 3 under LINE already do.

In tunnel mode, open `https://languze.com` rather than `localhost:3003`: the API only accepts requests from the origin it is configured for, and the browser blocks the rest without saying why.

`next.config.ts` allows `languze.com` as a development origin. Without it the Next.js development server refuses to serve its scripts to that origin, so pages render but no button does anything, and the only clue is a failed `/_next/hmr` WebSocket in the browser console.

**Cloudflare must not cache the development server's JavaScript.** Next.js serves its chunks with `Cache-Control: no-cache`, but a Cloudflare zone rewrites that to its **Browser Cache TTL**, four hours by default. The browser then keeps old chunks while the dev server rebuilds new ones at the same addresses, and the page ends up running two versions of the same code: buttons throw before sending any request, and the console stays empty. Set **Caching → Configuration → Browser Cache TTL** to **Respect Existing Headers** once, for the whole zone. It is also the right setting for production, where Next.js sends its own long-lived headers for hashed files.

To check: `curl -sI https://languze.com/_next/static/chunks/<any-chunk>.js | grep -i cache-control` should answer `no-cache, must-revalidate`, not `max-age=14400`. After changing it, purge Cloudflare's cache and empty the browser's own (DevTools open, right-click reload, **Empty cache and hard reload**).

**Restart `pnpm dev` after switching branches.** Git rewrites `next.config.ts` at each step of a checkout, and the development server can restart on an intermediate version — then `allowedDevOrigins` is missing and every request from `languze.com` is refused, with the same empty console.

**When something does nothing in the browser, open the console first** (F12). `curl` skips exactly the checks a browser enforces — CORS and the origin headers — so a request can succeed from the terminal and be blocked in the page.

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

| Command                                         | Purpose                                              |
| ----------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                                      | Web + API in watch mode                              |
| `pnpm lint` / `pnpm typecheck`                  | ESLint / TypeScript in every app                     |
| `pnpm test`                                     | Unit and component tests (no database needed)        |
| `pnpm test:e2e`                                 | API e2e tests (needs PostgreSQL and `DATABASE_URL`)  |
| `pnpm build`                                    | Production builds                                    |
| `pnpm format` / `pnpm format:check`             | Prettier                                             |
| `pnpm infra:up` / `pnpm infra:down`             | Start / stop local infrastructure                    |
| `pnpm --filter @languze/api prisma:migrate`     | Create and apply a migration (`prisma migrate dev`)  |
| `pnpm --filter @languze/api exec prisma studio` | Browse data                                          |
| `pnpm --filter @languze/api openapi:generate`   | Rewrite `apps/api/openapi.json` from the controllers |
| `pnpm --filter @languze/web api:types`          | Rewrite the web app's types from that document (E4)  |

Both generated files are committed, so the web app type-checks without a running API. Run the two commands, in that order, whenever a request or response shape changes; the web app then reports the change as a type error instead of a bug at runtime.

`pnpm test:e2e` runs against the development database and removes only the accounts it created, so accounts you sign in with by hand survive it. It sets its own `WEB_ORIGIN`, `AUTH_URL` and `COOKIE_DOMAIN`, so it passes whether your `.env` is in local or tunnel mode.

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
