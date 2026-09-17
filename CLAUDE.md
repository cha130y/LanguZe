# LanguZe — Claude Code Project Instructions

## Project

LanguZe is an AI-powered gamified language-learning platform built around the idea:
**Learn from your world.**

Core loop:
`image/world -> AI analysis -> vocabulary -> game -> answer -> mistakes/progress -> personalization -> AI Tutor`

## Repository shape

Expected monorepo layout:

- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend
- `packages/*` — shared contracts/config/utilities only when a real boundary exists
- `docs/*` — requirements, architecture, flows, AI, testing, deployment

Do not assume a directory or package exists. Inspect the repository before editing.

## Commands

pnpm workspace (Node 24). Run from the repository root:

- `pnpm infra:up` / `pnpm infra:down` — local PostgreSQL 18 (+pgvector) and Maildev via Docker Compose
- `pnpm dev` — web (:3003) and api (:4001) in watch mode
- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm format:check`
- `pnpm test:e2e` — api e2e tests; requires a reachable database
- `pnpm --filter @languze/api exec prisma <command>` — Prisma CLI (config: `apps/api/prisma7.config.ts`)

Toolchain pins and their reasons live in `docs/architecture/adr/0002-toolchain-baseline.md`. In particular, never install `prisma@latest` (currently a v8 release candidate) and keep TypeScript on 6.0.x.

## Core stack

Use the versions and actual dependencies declared by the repository as the source of truth. Target architecture:

- Next.js / React / TypeScript / Tailwind / shadcn/ui
- NestJS / TypeScript
- Prisma / PostgreSQL
- Better Auth
- TanStack Query / React Hook Form / Zod
- Socket.IO when realtime is required
- Redis when caching, rate limiting, transient state, or leaderboard requirements justify it
- RabbitMQ when durable asynchronous domain events are actually needed
- AI provider abstraction with interchangeable providers
- pgvector for RAG before introducing a separate vector database
- Docker / Docker Compose

Never add a technology merely to demonstrate a skill. Every infrastructure component must have a documented use case.

## Source of truth

When sources conflict, use this order:

1. Current source code and tests
2. Prisma schema + migrations
3. Accepted ADRs
4. SRS / approved requirements
5. Architecture / process-flow documentation
6. README and status prose

Do not invent missing requirements. If a decision is ambiguous and materially affects architecture or data, ask before implementing.

## Non-negotiable engineering rules

- Preserve unrelated user changes. Inspect `git status` and the diff before editing.
- Prefer the smallest coherent change that solves the requested problem.
- Do not introduce dependencies without a concrete reason and impact assessment.
- Do not expose secrets, tokens, credentials, or private user data.
- Never read or print `.env`, `.env.*`, credentials, private keys, or secret stores unless the user explicitly asks for a safe, narrowly scoped inspection.
- Do not modify database schema without a Prisma migration and corresponding documentation updates when the domain model changes.
- Treat external AI output as untrusted input: validate structured output before persistence or business decisions.
- Business logic must not depend directly on a concrete AI provider.
- Do not claim a test, build, migration, or verification passed unless it was actually run.
- Do not silently fix unrelated failures discovered during verification; report them separately.
- Do not rewrite working code solely to match personal preference.

## Architecture

Start as a Modular Monolith. Keep domain boundaries explicit and extract services only when scale, deployment, ownership, or reliability requirements justify it.

Recommended backend boundaries:

- auth
- users
- worlds / images
- vocabulary
- learning / mastery
- games
- progress / achievements
- notifications
- AI / tutor
- realtime

Prefer domain ownership over technical-layer sprawl. Controllers stay thin; application/business rules belong in services/use-cases; persistence concerns stay behind the repository/data-access boundary used by the codebase.

## Frontend

- Prefer Server Components in Next.js unless client state, browser APIs, or interactivity require `use client`.
- Use TanStack Query for server state where appropriate.
- Use React Hook Form + Zod for complex forms.
- Preserve loading, error, empty, and optimistic states where the UX requires them.
- Follow existing design-system components before creating new primitives.
- Accessibility and responsive behavior are part of feature completion.

## Backend

- Validate external input at the boundary.
- Use explicit response DTOs/contracts rather than leaking persistence models.
- Keep transaction boundaries around business invariants.
- Do not emit realtime/domain events before the transaction that establishes their facts commits.
- Keep provider SDK calls behind adapters/services.

## AI

AI features require four layers:

1. Input contract and validation
2. Provider abstraction
3. Structured output validation + deterministic post-processing
4. Evaluation cases for behavior that matters to the product

For RAG, distinguish retrieved context from model-generated content. Do not treat retrieval as proof. Minimize user data sent to external providers.

## Documentation

When a change affects behavior, architecture, schema, or an important AI decision, update the relevant documentation in the same change when practical.

Key locations:

- `docs/requirements/`
- `docs/architecture/`
- `docs/flows/`
- `docs/ai/`
- `docs/testing/`
- `docs/deployment/`

Use ADRs for significant architectural decisions, not every implementation detail.

## Workflow

Before editing:

1. Inspect repository status and structure.
2. Identify the affected domain.
3. Read the relevant requirement and ADRs.
4. Trace the existing implementation and tests.
5. State a short implementation plan for non-trivial work.

After editing:

1. Run focused tests first.
2. Run typecheck/lint/build as appropriate.
3. Review the final diff.
4. Check for accidental files, secrets, generated artifacts, and unrelated changes.
5. Update docs when the change requires it.
6. Report exactly what was verified and what was not.

## Git

- `main` is the protected integration branch unless the repository explicitly defines another target.
- Feature branches use `<type>/<short-description>` such as `feat/image-vocabulary` or `fix/tutor-context`.
- Commit subjects use Conventional Commits: `<type>(<scope>): <imperative summary>`.
- Do not add AI attribution trailers such as `Co-Authored-By: Claude`.
- Never force-push or merge into protected branches unless the user explicitly requests that operation.
- Use `/commit` for the project shipping workflow; it requires explicit user confirmation before commit/push/PR preparation.

## Completion standard

A feature is not complete merely because code was written. It is complete when the relevant behavior is implemented, verified, and the final diff is coherent.
