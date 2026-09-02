# ADR-003 — Backend Architecture & Modular Monolith

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow coordinates construction Work Orders, workforce eligibility, project setup, field execution, and quality control. The backend system must maintain strict transaction invariants (e.g. one-winner self-acceptance, schedule conflict hard blocks, Hold Point gating) while maintaining clear architectural boundaries without incurring the high operational overhead of distributed microservices.

## Decision

We adopt **NestJS** (TypeScript) implementing a **Modular Monolith** combined with a pragmatic **Clean Architecture** pattern.

### Architecture Style

1. **Modular Monolith**: The backend is deployed as a single, unified Node.js application process, but organized internally into strict, isolated logical business modules.
2. **Clean Architecture within Modules**: Each module organizes its internal layers cleanly:
   - **Domain**: Entities, value objects, domain invariants, repository/port interfaces.
   - **Application**: Use cases, command/query handlers, business workflows.
   - **Infrastructure**: Database repositories (Prisma adapters), external services, hashing adapters.
   - **Interface / API**: NestJS Controllers, DTOs with validation, Guards, Interceptors.
3. **Pragmatic Boundary Rule**: We apply Clean Architecture without over-engineering. We do not invent generic repository wrappers, unneeded CQRS engines, or artificial event buses when direct transactional services suffice.

### Logical Module Catalog

The backend consists of exactly 7 logical business modules derived from the foundation module map:

1. **Identity & Access (IAM)**: Authentication, account management, project-scoped authorization, session tokens, audit access.
2. **Workforce**: Worker profiles, contractor relations, trades/skills catalog, Crew management, Crew Lead history.
3. **Project Setup**: Projects, construction areas/categories, Work Types, mandatory hard dependencies.
4. **Work Management**: Work Order lifecycle (`Draft → Ready → Open/Assigned → In Progress → Work Done → Closed`), scheduling, Job Board, direct assignment, self-accept.
5. **Field Execution**: Pre-start readiness checks, independent blocker lifecycle, progress/log updates, Work Order material planning & supplement requests, Work Done submission.
6. **Quality Control**: Versioned checklist templates/instances, Pre-activity/Hold Point/Final inspection checkpoints, immutable inspection rounds, rectification lifecycle, quality close gate.
7. **Notification & Insight**: In-app notifications, operational dashboard aggregations, Closed-based project progress KPIs, CSV data export, audit log read surface.

### Cross-Module Interaction Rules

- Modules must communicate via explicit TypeScript application service interfaces (contracts), not direct SQL joins across another module's private tables.
- No microservices, No GraphQL, and No distributed event brokers (e.g. Kafka/RabbitMQ) in the V1 baseline.

## Alternatives considered

- **Microservices Architecture**: Rejected. Distributed transactions, network latency, multi-service deployment, and eventual consistency would severely complicate Work Order assignment concurrency and quality close gates.
- **Raw Express / Fastify without framework**: Rejected. Lacks structured dependency injection, modular encapsulation, and built-in OpenAPI integration.
- **GraphQL API**: Rejected. REST API provides simpler caching, straightforward presigned URL handling, lower client complexity, and deterministic schema contracts.

## Consequences

### Positive

- Simple, reliable single-process deployment and local development setup.
- ACID database transactions across critical business gates (e.g. Work Management assignment + eligibility validation).
- High maintainability through strong modular encapsulation and clear module ownership.
- Direct alignment with the BuildFlow Foundation requirements.

### Negative / trade-offs

- Developers must maintain modular discipline and avoid importing another module's private internal repositories directly.

## Constraints

- Backend is the sole authority for business logic and authorization.
- Microservices, GraphQL, and distributed event brokers are strictly forbidden in V1.

## Related requirements / documents

- [docs/foundation/MODULE-MAP.md](../../foundation/MODULE-MAP.md)
- [docs/foundation/PRODUCT-BASELINE.md](../../foundation/PRODUCT-BASELINE.md)
- [ADR-006](ADR-006-api-contract.md) — API Contract & Code Generation
- [ADR-007](ADR-007-postgresql-database.md) — Relational Database Platform

## Supersedes / Superseded by

None.
