# ADR-011 — Deferred Redis Adoption

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

Preliminary project outlines and generic web blueprints frequently mention Redis as a default technology for caching and queues. However, introducing an in-memory key-value store adds operational complexity: another container to manage, cache invalidation synchronization logic, split persistence paths, and potential data-drift failure modes. We must evaluate whether Redis is a genuine, mandatory dependency for BuildFlow V1.

## Decision

We decide that **Redis is NOT a mandatory dependency of BuildFlow V1** and its adoption is **formally deferred**.

### Architecture Rationale

1. **PostgreSQL 18.x Adequacy**: PostgreSQL easily handles the V1 target dataset size (10,000+ Work Orders, 50,000+ audit records per `NFR-PERF-004`) with sub-millisecond indexed queries, connection pooling, and transactional session management.
2. **Session Storage in PostgreSQL**: Server-side session tracking and refresh token rotation are fully persisted in PostgreSQL (`sessions` table) without needing Redis.
3. **No Premature Optimization**: In a single-instance Modular Monolith, in-process caching (or HTTP cache headers with TanStack Query) satisfies all response time targets (2s read, 3s write per `NFR-PERF-001`, `NFR-PERF-002`).
4. **Concrete Evidence Gate for Future Adoption**: Redis will only be introduced into the architecture if and when concrete empirical requirements arise, such as:
   - Clustered multi-instance backend deployment requiring distributed cache coordination.
   - High-volume background job processing / asynchronous queue workers (e.g. BullMQ).
   - Distributed rate limiting across multiple backend nodes.
   - Benchmarking evidence demonstrating that PostgreSQL query caching fails performance criteria.

Until such evidence is documented and approved through change control, **Redis remains excluded from the V1 infrastructure baseline**.

## Alternatives considered

- **Mandatory Redis Setup in V1**: Rejected. Adds unnecessary DevOps maintenance overhead and failure points to the student capstone setup without measurable performance necessity.
- **In-Memory Volatile Caches (Node Cache)**: Rejected for shared state; simple PostgreSQL queries with proper indexes suffice.

## Consequences

### Positive

- Leaner infrastructure: fewer moving parts, lower RAM consumption on developer machines and deployment VPS.
- Zero cache-invalidation bugs (e.g. stale Work Order status or outdated quality gate checks).
- Single system of record for all data, sessions, and state transitions.

### Negative / trade-offs

- Session lookups and token validation perform a fast indexed database query instead of an in-memory RAM lookup.

## Constraints

- Developers must not add `@nestjs/bull` or Redis client dependencies to `apps/api` in V1 without an approved ADR update.

## Related requirements / documents

- [docs/foundation/QUALITY-ATTRIBUTES.md](../../foundation/QUALITY-ATTRIBUTES.md) (`NFR-PERF-001`, `NFR-PERF-004`)
- [ADR-007](ADR-007-postgresql-database.md) — Relational Database Platform
- [ADR-009](ADR-009-authentication-session.md) — Authentication & Session Management
- [ADR-014](ADR-014-deployment-platform.md) — Containerized Deployment Topology

## Supersedes / Superseded by

None.
