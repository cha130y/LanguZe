# LanguZe — Testing Strategy

- **Document status:** Draft v0.1
- **Date:** 2026-09-20
- **Release covered:** Release 1.0
- **Source:** [user stories, Definition of Done](../requirements/user-stories.md#2-definition-of-done), [SRS 5.1 evaluation cases](../requirements/SRS.md#51-evaluation-cases-minimum), [ADR-0002](../architecture/adr/0002-toolchain-baseline.md), [build plan](../planning/build-plan.md)

## 1. Principles

- **Acceptance criteria drive tests.** Each Given/When/Then criterion in the user stories becomes at least one automated test, at the lowest level that proves it.
- **Test business rules, not implementation details.** Answer checking, mastery, limits, suspension rules, and authorization deserve thorough tests; framework wiring needs only enough to show it is connected.
- **No real external services in automated tests.** AI providers, photo storage, identity providers, and email are replaced by fakes or local stand-ins. Real providers are exercised only by the AI evaluation and by manual checks.
- **A test that cannot run is reported, not skipped silently.** If infrastructure is missing, say so and run what can run.

## 2. Test levels

| Level          | Tool                              | Location                                      | What it covers                                                                                                                         | Runs in                                                                      |
| -------------- | --------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| API unit       | Vitest                            | `apps/api/src/**/*.spec.ts`, next to the code | Pure rules (answer normalization, mastery, day boundaries, suspension rules), services with their collaborators faked, guards, filters | `pnpm test`, CI                                                              |
| API end-to-end | Vitest + Supertest + PostgreSQL   | `apps/api/test/*.e2e-spec.ts`                 | Every endpoint: success, main error codes, authorization, transactions; the whole application with `configureApp`, as in production    | `pnpm test:e2e`, CI with a PostgreSQL service                                |
| Web            | Vitest + Testing Library + jsdom  | `apps/web/src/**/*.test.tsx`                  | Components, forms, states (loading, error, empty), accessibility of labels and roles                                                   | `pnpm test`, CI                                                              |
| AI evaluation  | A separate command (increment 13) | To be decided with increment 13               | The cases of SRS 5.1 against the real AI provider: safety check, extraction, tutor grounding and scope, prompt injection               | Manually before launch and before any model change; never in pull-request CI |
| Manual         | Real browsers and phones          | Checklists in the build plan increments       | Sign-in in Safari and the LINE and Facebook in-app browsers, photo capture on phones, usability testing with learners                  | Increments 3 and 14                                                          |

## 3. Conventions

- **Names describe behavior** in plain English, for example `refuses a request that changes data without an Origin header`, so a failing test reads as a broken rule.
- **Given/When/Then from the stories** maps to arrange, act, and assert inside the test.
- **End-to-end tests build the application the way `main.ts` does**, through `configureApp`, so validation, errors, CORS, the `/v1` prefix, and guards are the real ones.
- **Test-only controllers** may be registered in end-to-end tests to exercise shared behavior before feature endpoints exist, as `test/platform.e2e-spec.ts` does. They never ship.
- **Each end-to-end test file creates the data it needs** and does not depend on data from other files. Once tables exist (increment 2), a helper resets the tables a file uses before it runs.
- **Fakes live next to the interface they replace**, for example the fake AI provider behind the AI interface (build plan decision B4), so every test and local run uses the same fake.
- **Time is injected** where a rule depends on it, such as Bangkok days, 24-hour sessions, and 7-day suspensions, so tests set the clock instead of waiting.

## 4. What must be covered

- Every acceptance criterion of the stories in the increment.
- Every error code an endpoint can return, with its HTTP status.
- Authorization: a learner can never read or change another learner's data (FR-008); admin endpoints refuse everyone else (FR-100).
- Invariants saved in one transaction: the attempt with its mastery and XP, the admin action with its audit entry, a daily limit with its new use.
- Privacy rules: logs and error responses never contain passwords, tokens, photos, prompts, tutor text, or query strings (NFR-008).

There is no numeric coverage target. A pull request is reviewed for whether its rules and error paths are tested, not for a percentage.

## 5. Continuous integration

Every pull request runs, as defined in `.github/workflows/ci.yml`:

1. Formatting, lint, and type checks.
2. API and web unit tests.
3. Production builds.
4. API end-to-end tests against a fresh PostgreSQL database, after `prisma migrate deploy`.

A pull request is merged only when all of them pass.
