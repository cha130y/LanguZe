# LanguZe documentation

Documentation grows with the product: a document is added when the decision or feature it describes becomes real.

## Current documents

| Document                                                                                 | Purpose                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [PRD](requirements/PRD.md) (draft)                                                       | Product vision, target users, Release 1.0 scope, success metrics         |
| [SRS](requirements/SRS.md) (draft)                                                       | Functional, AI, and non-functional requirements for Release 1.0          |
| [User stories](requirements/user-stories.md) (draft)                                     | Release 1.0 user stories with acceptance criteria (`US-xxx`)             |
| [Use cases](requirements/use-cases.md) (draft)                                           | Step-by-step interactions, including failures (`UC-xxx`)                 |
| [Process flows](flows/README.md) (draft)                                                 | How web, API, database, and external services carry out each use case    |
| [Architecture overview](architecture/overview.md) (draft)                                | Systems, applications, API modules, cross-cutting rules, deployment view |
| [Data model](architecture/data-model.md) (draft)                                         | ERD, data dictionary, deletion rules, and personal data map              |
| [ADR-0001: Modular monolith](architecture/adr/0001-modular-monolith.md)                  | Why LanguZe starts as one deployable API                                 |
| [ADR-0002: Toolchain baseline](architecture/adr/0002-toolchain-baseline.md)              | Framework/tool versions, pins, and the reasons                           |
| [ADR-0003: Better Auth inside the API](architecture/adr/0003-better-auth-in-api.md)      | Authentication choice and its configuration                              |
| [ADR-0004: Google Gemini as the first AI provider](architecture/adr/0004-ai-provider.md) | AI provider, paid tier, models, safety check, and tutor settings         |
| [ADR-0005: PostgreSQL and pgvector](architecture/adr/0005-postgresql-and-pgvector.md)    | PostgreSQL as the only database; pgvector when RAG arrives               |
| [Local development](deployment/local-development.md)                                     | Setup, environment variables, commands, troubleshooting                  |

## Planned structure

| Folder          | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `requirements/` | PRD, SRS (`FR-xxx`), user stories (`US-xxx`), use cases (`UC-xxx`)       |
| `architecture/` | Overview, ERD + data dictionary, API design, ADRs in `architecture/adr/` |
| `flows/`        | Authentication, image-to-vocabulary, game session, AI tutor, moderation  |
| `ai/`           | Provider abstraction, vision pipeline, vocabulary generation, tutor, RAG |
| `testing/`      | Testing strategy                                                         |
| `deployment/`   | Local development, Docker, CI/CD                                         |

Recommended order before feature development: PRD → SRS → user stories → use cases → main process flows → architecture overview → ERD → remaining ADRs (Better Auth, AI provider abstraction, PostgreSQL + pgvector) → API design.

Requirements documents are written in English; Thai explanations may be added where they help.
