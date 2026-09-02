# Architecture Decision Records (ADRs)

This directory contains the canonical Architecture Decision Records for the **BuildFlow** platform.

## Authority and Governance

- All technical decisions recorded here have been approved and accepted by the Project Owner and BuildFlow Team.
- **ADRs are the sole architecture authority** for technology choices, runtimes, frameworks, persistence, security, and deployment topology.
- Legacy source code, boilerplate templates, and previous scaffolds **do not** constitute architecture authority.

## ADR Index

| ADR ID | Title | Status | Date | Decision Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-001](ADR-001-monorepo-workspace.md) | Monorepo & Workspace Architecture | Accepted | 2026-09-02 | `pnpm Workspaces` + `Turborepo`; `apps/{api,web,mobile}`, `packages/{api-client,contracts,eslint-config,tsconfig}`. |
| [ADR-002](ADR-002-node-typescript-runtime.md) | Language and Runtime Baseline | Accepted | 2026-09-02 | `Node.js 24 LTS`, `TypeScript` (strict mode), `pnpm` sole package manager, locked via `.node-version`. |
| [ADR-003](ADR-003-backend-platform.md) | Backend Architecture & Modular Monolith | Accepted | 2026-09-02 | `NestJS` REST API, `Modular Monolith + Clean Architecture`. 7 logical business modules. No Microservices. |
| [ADR-004](ADR-004-web-platform.md) | Web Frontend Architecture | Accepted | 2026-09-02 | `Next.js 16` (App Router), `Ark UI`, `Tailwind CSS`, `TanStack Query`, `React Hook Form`, `Zod`. BFF/Consumer only. |
| [ADR-005](ADR-005-mobile-platform.md) | Mobile Platform Architecture | Accepted | 2026-09-02 | `React Native` + `Expo SDK 57` (Expo Router), `Android 10+` acceptance scope. Backend source of truth. |
| [ADR-006](ADR-006-api-contract.md) | API Contract & Code Generation | Accepted | 2026-09-02 | REST `/api/v1`, OpenAPI (Swagger), generated TypeScript API client in `packages/api-client` for Web & Mobile. |
| [ADR-007](ADR-007-postgresql-database.md) | Relational Database Platform | Accepted | 2026-09-02 | `PostgreSQL 18.x`, single shared physical database with logical module boundaries. No MongoDB/Microservice DBs. |
| [ADR-008](ADR-008-prisma-migrations.md) | ORM & Database Migration Strategy | Accepted | 2026-09-02 | `Prisma ORM 7.x` + `Prisma Migrate`. Reviewed SQL migrations for PostgreSQL partial indexes and check constraints. |
| [ADR-009](ADR-009-authentication-session.md) | Authentication & Session Management | Accepted | 2026-09-02 | Backend-owned auth: short-lived JWT + rotating hashed refresh session in PostgreSQL. HttpOnly cookie / SecureStore. |
| [ADR-010](ADR-010-attachment-storage.md) | Attachment & Media Storage Architecture | Accepted | 2026-09-02 | Binary files in S3-compatible storage (`MinIO` local/demo); metadata in PostgreSQL. Protected presigned URLs. |
| [ADR-011](ADR-011-redis-deferred.md) | Deferred Redis Adoption | Accepted | 2026-09-02 | Redis deferred from V1 baseline. PostgreSQL handles session, persistence, and business data without extra complexity. |
| [ADR-012](ADR-012-testing-platform.md) | Automated Testing Strategy & Tooling | Accepted | 2026-09-02 | Backend: Jest/Supertest + real PostgreSQL container. Web: RTL + Playwright. Mobile: RNTL + Maestro. API contract tests. |
| [ADR-013](ADR-013-ci-platform.md) | Continuous Integration Pipeline | Accepted | 2026-09-02 | `GitHub Actions` PR pipeline: lint, typecheck, unit test, PostgreSQL integration test, build API/Web, mobile validate. |
| [ADR-014](ADR-014-deployment-platform.md) | Containerized Deployment Topology | Accepted | 2026-09-02 | Linux VPS, `Docker Compose`, `Caddy` reverse proxy (HTTPS), NestJS, Next.js, PostgreSQL 18, MinIO. |
| [ADR-015](ADR-015-mobile-build.md) | Mobile Build & Distribution Strategy | Accepted | 2026-09-02 | `EAS Build` (development, preview, production). Android 10+ APK preview builds for physical device testing/defense. |
