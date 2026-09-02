# ADR-006 — API Contract & Code Generation

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

In a multi-client system (Web + Mobile) interacting with a single backend, manual synchronization of HTTP endpoints, request bodies, query parameters, and response types leads to runtime type errors, silent contract drift, and duplicate maintenance work. We need an automated, single source of truth for the API interface.

## Decision

We adopt a **Contract-First / Code-First OpenAPI workflow** with **Automated TypeScript Client Generation**.

### Architecture Workflow

```text
NestJS Controllers + DTOs (with Swagger Decorators & Zod validation)
    ↓
OpenAPI 3.0 Specification (/api-json / contracts/openapi.json)
    ↓
OpenAPI TypeScript Generator (openapi-typescript-codegen / orval)
    ↓
packages/api-client (Generated Typed API Client & Models)
    ↓
Consumed by apps/web and apps/mobile
```

### Key Contract Rules

1. **REST & JSON**: All endpoints follow standard RESTful conventions with JSON payloads.
2. **Version Prefix**: All public business endpoints are prefixed with `/api/v1` (e.g. `/api/v1/work-orders`, `/api/v1/iam/auth/login`).
3. **Single Generated Package**: The generated client is located in `packages/api-client` within the monorepo workspace.
4. **Mandatory CI Check**: CI verifies that the OpenAPI specification and the generated TypeScript client are completely up-to-date with controller DTO definitions on every pull request.
5. **No Separate Manual Fetch Clients**: Web and Mobile **must** consume `packages/api-client` for network requests to eliminate contract drift.

## Alternatives considered

- **Manual API client writing in Web and Mobile**: Rejected due to high risk of desynchronization and double maintenance effort.
- **gRPC / Protocol Buffers**: Rejected. Lacks native browser ergonomics without extra proxying layers like grpc-web, and adds unnecessary protocol overhead for a standard REST system.
- **GraphQL**: Rejected. REST + OpenAPI provides simpler HTTP caching, standard presigned URL workflows, and deterministic endpoint security.

## Consequences

### Positive

- Complete compile-time type safety from Backend DTOs to Web and Mobile UI components.
- Automatic IDE autocompletion for API endpoints, payload types, and error responses.
- API changes immediately surface compile errors in frontend code during build time if breaking changes occur.

### Negative / trade-offs

- Developers must regenerate the API client package (`pnpm generate:api-client`) after modifying backend DTOs/controllers.

## Constraints

- Hand-written fetch wrappers that bypass the generated API client in Web/Mobile are prohibited for core business operations.

## Related requirements / documents

- [ADR-001](ADR-001-monorepo-workspace.md) — Monorepo & Workspace Architecture
- [ADR-003](ADR-003-backend-platform.md) — Backend Architecture & Modular Monolith
- [ADR-013](ADR-013-ci-platform.md) — Continuous Integration Pipeline

## Supersedes / Superseded by

None.
