# ADR-013 — Continuous Integration Pipeline

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

To prevent regressions, contract desynchronization, and broken builds in a multi-application monorepo, every code change submitted via Pull Request must be automatically verified against strict quality gates before merging into the main branch.

## Decision

We adopt **GitHub Actions** as the Continuous Integration (CI) automation platform.

### Pull Request CI Pipeline Architecture

Every pull request triggers an automated GitHub Actions workflow executing the following stages in sequence:

```text
1. Checkout & Setup
   ├── Setup Node.js 24 LTS (via .node-version)
   ├── Setup pnpm with caching
   └── Turborepo Remote/Local Caching setup

2. Install Dependencies
   └── pnpm install --frozen-lockfile

3. Code Quality & Static Analysis
   ├── pnpm lint (ESLint across all apps & packages)
   └── pnpm typecheck (tsc --noEmit across all apps & packages)

4. API Contract & Client Verification
   └── Verify generated packages/api-client matches current OpenAPI spec

5. Unit & Component Tests
   ├── Apps/api unit tests
   ├── Apps/web component tests
   └── Apps/mobile component tests

6. Integration Tests (with real PostgreSQL container)
   ├── Spin up PostgreSQL 18 service container in GitHub Actions runner
   ├── Apply Prisma migrations (prisma migrate deploy)
   └── Run backend database integration & concurrency test suites

7. Build Verification
   ├── Build apps/api (NestJS production build)
   ├── Build apps/web (Next.js production build)
   └── Build packages/api-client and packages/contracts

8. Mobile Static Verification
   └── Expo / React Native static build validation & export check
```

### Pull Request Merge Policy

A Pull Request is **strictly blocked from merging** if any of the following conditions occur:
- Linting or formatting errors.
- TypeScript compiler errors in any app or package.
- API contract drift or outdated generated API client.
- Any unit, integration, or database test failure.
- Any production build failure in API or Web.

## Alternatives considered

- **GitLab CI / Jenkins / CircleCI**: Rejected. GitHub Actions is natively integrated with the GitHub repository, requires zero external server hosting, and supports Docker service containers natively.

## Consequences

### Positive

- Zero broken builds on main branch.
- Automated enforcement of the OpenAPI contract between Backend and Web/Mobile.
- Fast pipeline execution through Turborepo build and test caching.
- Automated testing against a clean, dedicated PostgreSQL instance on every PR.

### Negative / trade-offs

- CI runtime takes approximately 3–6 minutes per run depending on test volume.

## Constraints

- Direct commits to `main` without passing CI are prohibited.
- CI must run against Node.js 24 LTS with frozen lockfiles.

## Related requirements / documents

- [docs/foundation/GIT-WORKFLOW.md](../../foundation/GIT-WORKFLOW.md)
- [ADR-001](ADR-001-monorepo-workspace.md) — Monorepo & Workspace Architecture
- [ADR-002](ADR-002-node-typescript-runtime.md) — Language and Runtime Baseline
- [ADR-012](ADR-012-testing-platform.md) — Automated Testing Strategy & Tooling

## Supersedes / Superseded by

None.
