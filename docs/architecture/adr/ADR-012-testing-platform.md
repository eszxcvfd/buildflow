# ADR-012 — Automated Testing Strategy & Tooling

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow's non-negotiable business invariants (such as one-winner concurrent self-accept, single active assignment uniqueness, schedule interval overlap hard blocks, immutable inspection rounds, and QC-exclusive Hold Point releases) cannot be validated with superficial mock tests alone. We require a robust, multi-layer testing platform spanning Backend, Web, Mobile, and API contracts.

## Decision

We establish a comprehensive, multi-layer automated testing platform with mandatory real-database integration testing.

### Testing Stack by Layer

#### 1. Backend (`apps/api`)
- **Unit Testing**: **Jest** for isolated domain entity invariants, value object validation, and pure application business logic.
- **API Integration Testing**: **Supertest** + **Jest** executing HTTP requests against NestJS modules.
- **Database Integration Testing**: Executed against a **real PostgreSQL 18.x instance**.
  - CI uses a Docker service container or Testcontainers for repeatable isolation.
  - Local developers may use either PostgreSQL installed directly on the host
    or a container, selected through `DATABASE_URL`.
  - *Mandatory Rule*: Concurrency tests (20-way self-accept per `NFR-PERF-003`), database partial unique index enforcement, transaction atomicity, and schedule interval overlap checks **must be verified against real PostgreSQL**, never with in-memory or mocked repositories.

#### 2. Web Frontend (`apps/web`)
- **Component & Integration Testing**: **React Testing Library (RTL)** with **Jest** or **Vitest** for testing UI rendering, form submission behaviors, validation errors, and empty/loading states.
- **End-to-End (E2E) Testing**: **Playwright** for complete cross-browser user journeys (admin project creation, coordinator work dispatch, QC hold point releases).

#### 3. Mobile Client (`apps/mobile`)
- **Component & Screen Testing**: **React Native Testing Library (RNTL)** with **Jest** for mobile screens, form interactions, and offline fallback UI states.
- **Mobile Smoke & E2E Testing**: **Maestro** (or Expo-compatible testing tools) executing automated UI test flows targeting Android 10+ emulators/devices.

#### 4. API Contract & Integration Validation
- Verification that OpenAPI specifications accurately generate typed clients in `packages/api-client`.
- TypeScript typecheck verification ensuring zero contract drift between Backend controllers and Web/Mobile consumers.

## Alternatives considered

- **Mocked Repository Testing Only**: Strictly rejected. In-memory array mocks cannot catch SQL syntax errors, transaction isolation anomalies, foreign key violations, or partial unique index concurrency collisions.
- **Cypress for Web E2E**: Rejected in favor of Playwright, which provides faster parallel execution, better multi-tab support, and lower CI resource usage.

## Consequences

### Positive

- High confidence in core business invariants and concurrency safeguards before production deployment.
- Catch regressions early in the development lifecycle and CI pipeline.
- Realistic verification of database constraints and transaction rollbacks.

### Negative / trade-offs

- Integration tests require a running PostgreSQL 18.x instance; CI provides an
  isolated service container while each developer may choose native or
  containerized PostgreSQL locally.

## Constraints

- Mocked repositories are strictly forbidden as proof for concurrency, uniqueness, or transaction atomicity requirements.
- All Must requirements must trace to executable automated tests per `TEST-STRATEGY.md`.

## Related requirements / documents

- [docs/foundation/TEST-STRATEGY.md](../../foundation/TEST-STRATEGY.md)
- [docs/foundation/QUALITY-ATTRIBUTES.md](../../foundation/QUALITY-ATTRIBUTES.md) (`NFR-MNT-001`, `NFR-PERF-003`)
- [ADR-003](ADR-003-backend-platform.md) — Backend Architecture & Modular Monolith
- [ADR-013](ADR-013-ci-platform.md) — Continuous Integration Pipeline

## Supersedes / Superseded by

None.
