# ADR-007 — Relational Database Platform

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow manages structured, highly relational construction entities with strong integrity constraints:
- Work Orders, assignments, schedules, and dependencies.
- Multi-party workforce memberships and historical snapshots.
- Quality control checklists, hold points, immutable inspection rounds, and rectifications.
- Auditing, session management, and project-scoped access boundaries.

The persistence engine must guarantee ACID transactions, support partial unique indexing for active assignment concurrency, enforce relational constraints, and provide deterministic execution for the Modular Monolith.

## Decision

We adopt **PostgreSQL 18.x** as the single shared physical database for the BuildFlow system.

### Database Architecture Rules

1. **Single Shared Physical Database**: All 7 logical backend modules reside within a single PostgreSQL database instance.
2. **Logical Data Ownership**: Tables are logically owned by their respective modules (e.g. `users`, `roles` owned by IAM; `work_orders`, `assignments` owned by Work Management; `inspections`, `corrective_actions` owned by QC). Modules must not perform direct mutating SQL joins on tables owned by another module.
3. **No Database-per-Module**: We explicitly reject creating separate database instances or microservice databases in V1.
4. **No MongoDB / Document DB as Primary Store**: PostgreSQL handles all business entities, transactional history, and session states.
5. **Relational Invariants**:
   - UUID primary keys across business tables.
   - `timestamptz` stored in UTC.
   - Partial unique indexes (e.g., ensuring exactly one `ACTIVE` assignment per Work Order).
   - Foreign key integrity, check constraints, and append-only audit tables.

## Alternatives considered

- **MySQL / MariaDB**: Rejected. PostgreSQL provides superior partial unique index support, advanced JSONB indexing, robust CHECK constraints, and better transactional reliability.
- **MongoDB / NoSQL**: Rejected. Document stores lack native multi-table ACID transaction ergonomics and relational integrity required for strict construction state gates.
- **Database-per-module (Microservices DBs)**: Rejected. Introduces unnecessary distributed transaction overhead (Saga/2PC) and operational complexity for a single-company platform.

## Consequences

### Positive

- Strong ACID guarantees for critical operations (one-winner self-accept, assignment creation, Hold Point releases, Quality Close gate).
- High query performance and rich indexing (B-Tree, partial indexes, GIN for JSONB when needed).
- Simple backup, restore, and single-instance Docker deployment.

### Negative / trade-offs

- Team must maintain code-level discipline to preserve logical module boundaries despite sharing a physical database.

## Constraints

- PostgreSQL 18.x is the required database engine.
- Direct table mutation across module boundaries is forbidden.

## Related requirements / documents

- [docs/foundation/DATA-BASELINE.md](../../foundation/DATA-BASELINE.md)
- [ADR-003](ADR-003-backend-platform.md) — Backend Architecture & Modular Monolith
- [ADR-008](ADR-008-prisma-migrations.md) — ORM & Database Migration Strategy

## Supersedes / Superseded by

None.
