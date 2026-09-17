# LanguZe

> **Learn from your world.**

LanguZe (pronounced _แลน-กุ-เซ่_) is an AI-powered, gamified language-learning platform. Photos of the learner's own surroundings become vocabulary lessons and games, mistakes drive personalized practice, and an AI tutor uses the learner's history to explain and coach.

```text
image/world → AI analysis → vocabulary → game → answer → mistakes/progress → personalization → AI tutor
```

**Status:** project foundation. The monorepo, tooling, local infrastructure, and CI are in place; product features have not been implemented yet.

## Tech stack

| Area             | Current foundation                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Web (`apps/web`) | Next.js 16 (App Router), React 19.3, TypeScript 6.0, Tailwind CSS 4.3, shadcn/ui         |
| API (`apps/api`) | NestJS 12 (ESM), Prisma 7 with the `pg` driver adapter, class-validator, Swagger         |
| Database         | PostgreSQL 18 with pgvector available                                                    |
| Testing          | Vitest 5 + Testing Library (web), Vitest 5 + Supertest (api)                             |
| Tooling          | pnpm 11 workspace, ESLint, Prettier, Husky + lint-staged, Docker Compose, GitHub Actions |

Planned additions (Better Auth, TanStack Query, React Hook Form + Zod, AI providers, Socket.IO, Redis, RabbitMQ, RAG) are introduced with the features that need them. See [ADR-0002](docs/architecture/adr/0002-toolchain-baseline.md) for version pins.

## Repository layout

```text
apps/
  web/        Next.js frontend
  api/        NestJS backend (Prisma schema in apps/api/prisma)
docs/         requirements, architecture (ADRs), flows, AI, testing, deployment
.claude/      Claude Code rules, skills, and agents (see .claude/README.md)
.github/      CI workflow
docker-compose.yml   local PostgreSQL + Maildev
```

## Getting started

Prerequisites: Node.js 24, pnpm 11, Docker.

```bash
pnpm install
pnpm infra:up
# create apps/api/.env — see docs/deployment/local-development.md
pnpm dev
```

- Web: http://localhost:3003
- API health: http://localhost:4001/health
- API docs (Swagger, non-production): http://localhost:4001/docs
- Maildev inbox: http://localhost:1081

Full setup, environment variables, and troubleshooting: [docs/deployment/local-development.md](docs/deployment/local-development.md).

## Common commands

| Command                        | Purpose                          |
| ------------------------------ | -------------------------------- |
| `pnpm dev`                     | Run web and api in watch mode    |
| `pnpm lint`                    | ESLint in every app              |
| `pnpm typecheck`               | TypeScript checks in every app   |
| `pnpm test`                    | Unit/component tests             |
| `pnpm test:e2e`                | API e2e tests (needs PostgreSQL) |
| `pnpm build`                   | Production builds                |
| `pnpm format` / `format:check` | Prettier write / check           |

## Documentation

Start at [docs/README.md](docs/README.md).
