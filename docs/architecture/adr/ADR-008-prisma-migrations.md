# ADR-008 — ORM & Database Migration Strategy

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

Managing database schema evolution, model mappings, and typed query execution requires an ORM and migration tool that integrates cleanly with TypeScript and NestJS. Furthermore, specific database constraints (such as partial unique indexes for single active assignments, check constraints, and immutable audit structures) are required by the BuildFlow data baseline.

## Decision

We adopt **Prisma ORM 7.x** with **Prisma Migrate** targeting **PostgreSQL 18.x**.

### Key Rules and Decisions

1. **Version Pinning (Prisma 7.x)**: We intentionally lock the baseline to **Prisma 7.x** and **do not** upgrade to Prisma 8 in this baseline. Prisma 8 is a major release with breaking changes, whereas Prisma 7.x offers proven maturity and stability for the project.
2. **Schema Definition**: The database schema is declared in `apps/api/prisma/schema.prisma` mapping to PostgreSQL tables.
3. **Migration Management via Prisma Migrate**: Schema changes are applied via forward-only, versioned migration files in `apps/api/prisma/migrations/`.
4. **Custom SQL for Advanced Invariants**: Where Prisma's schema DSL cannot natively express PostgreSQL-specific constraints (e.g. `CREATE UNIQUE INDEX ... WHERE status = 'ACTIVE'`, complex `CHECK` constraints, or partial indexes), migrations are augmented using **reviewed custom migration SQL** (`prisma migrate dev --create-only` followed by editing the generated migration SQL).
5. **No Weakening of Business Invariants**: Invariants defined in `DATA-BASELINE.md` (such as one active assignment per Work Order, mandatory responsible party on blockers, acyclic dependencies) must never be relaxed simply because of ORM abstraction limitations.

## Alternatives considered

- **TypeORM**: Used in the old scaffold. Rejected due to maintainer stagnation, decorator metadata drift, fragile migration generation, and runtime reflection issues.
- **Drizzle ORM**: Considered for its SQL-like ergonomics, but rejected in favor of Prisma 7.x due to Prisma's mature ecosystem, strong NestJS integration, and robust declarative migration tooling for capstone velocity.
- **Prisma 8**: Rejected. As a brand-new major release, it carries potential ecosystem incompatibilities with other NestJS packages.

## Consequences

### Positive

- Fully auto-generated, type-safe query client with IDE autocompletion for backend repositories.
- Declarative schema with deterministic migration tracking and rollback/history visibility.
- Seamless developer ergonomics across team members.

### Negative / trade-offs

- Custom PostgreSQL features (partial indexes, raw triggers) require manual SQL additions inside migration files.

## Constraints

- Prisma ORM 7.x is the required ORM version; upgrading to Prisma 8 is prohibited in V1 baseline.
- All schema modifications must go through version-controlled Prisma migrations.

## Related requirements / documents

- [docs/foundation/DATA-BASELINE.md](../../foundation/DATA-BASELINE.md)
- [ADR-007](ADR-007-postgresql-database.md) — Relational Database Platform

## Supersedes / Superseded by

None.
