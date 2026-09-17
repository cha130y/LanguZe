# Migration from CBeave / BidNest

## Keep

- Source-of-truth hierarchy
- Preflight git/diff inspection
- Explicit test verification
- Requirement IDs / traceability
- Vertical feature delivery
- Confirmation-gated commit/push workflow
- Explicit staging paths
- Final diff review
- Cross-checking reference implementations instead of blind copy/paste

## Move

| Old pattern | LanguZe location |
|---|---|
| Large `agentskill.md` | Split into `.claude/rules/*` + `.claude/skills/*` |
| `dev4.md` | Generalized into `/feature` + domain rules |
| `commit.md` / `commit/SKILL.md` | `.claude/skills/commit/SKILL.md` |
| `client-graph.mjs` | Keep as a project utility only if the LanguZe Next.js app needs it |
| Developer-specific role instructions | `.claude/agents/*` when they are reusable specialist behavior |
| Temporary discoveries | Claude Code auto memory |
| Hard security constraints | settings permissions / hooks, not only prose |

## Deliberate differences

- LanguZe does not inherit BidNest auction-specific rules, SRS IDs, branch names, or main/dev assumptions.
- LanguZe starts with Modular Monolith boundaries and adds Redis/RabbitMQ/RAG only when a real requirement exists.
- AI provider behavior is isolated behind an application-level abstraction.
- AI output is treated as untrusted data and evaluated separately from ordinary deterministic tests.
