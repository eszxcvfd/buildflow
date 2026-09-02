# ADR-004 — Web Frontend Architecture

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

The Web channel serves Administrators, Project Managers, Coordinators, and QC engineers on desktop browsers. It requires rich management views (project configuration, workforce planning, schedule timelines, Work Order boards, checkpoint reviews, operational dashboards, audit logs, CSV exports). The frontend architecture must remain clean, highly performant, accessible, and strictly decoupled from database/business truth.

## Decision

We adopt **Next.js 16** with **React**, **TypeScript**, and a **Feature-based Modular Architecture**.

### Technology Stack

- **Framework**: **Next.js 16** (App Router architecture).
- **Language**: TypeScript (strict mode).
- **UI Primitives**: **Ark UI** (accessible, headless component primitives).
- **Styling**: **Tailwind CSS** (utility-first, responsive design tokens).
- **Server State & Data Fetching**: **TanStack Query** (React Query) for API caching, background refetching, and optimistic updates.
- **Form Management & Validation**: **React Hook Form** combined with **Zod** schema validation.

### Architecture Rules

1. **Feature-based Modular Structure**: The Web codebase is organized by business feature domains (`features/iam`, `features/workforce`, `features/projects`, `features/work-orders`, `features/quality`, `features/dashboard`), matching the logical backend modules.
2. **Pure API Consumer**: Next.js operates purely as a presentation layer and BFF consumer.
3. **No Direct Database Access**: Next.js **never** connects directly to PostgreSQL. All state mutations and data reads go through the NestJS REST API via the generated API client.
4. **No Duplicate Business Logic**: Business validation and authorization reside on the NestJS backend. Web performs form-level UX validation (via Zod schemas matching API contracts) but never acts as the source of truth.
5. **No Auth.js / NextAuth as Identity Authority**: Authentication and session state are managed by the NestJS backend (see ADR-009).

## Alternatives considered

- **Vite / React SPA**: Considered, but Next.js 16 provides superior routing conventions (App Router layout nesting), server-side rendering for initial shell load, and unified Node.js deployment.
- **NextAuth.js / Auth.js**: Rejected. Distributing authentication logic across both Next.js and NestJS introduces session synchronization bugs. NestJS remains the single identity authority.
- **Chakra UI / MUI**: Rejected in favor of Ark UI + Tailwind CSS, which provides headless accessibility with zero CSS-in-JS runtime overhead.

## Consequences

### Positive

- Robust, accessible UI built on Ark UI primitives and Tailwind CSS.
- Clean separation between presentation concerns and backend business rules.
- Predictable server state synchronization with TanStack Query.
- Standardized form validation with React Hook Form and Zod schemas shared from contracts.

### Negative / trade-offs

- Developers must respect the boundary and not write backend server actions that attempt direct database querying.

## Constraints

- Next.js must strictly interact with the backend via the `/api/v1` REST API.
- Direct PostgreSQL connections from Next.js are strictly prohibited.

## Related requirements / documents

- [ADR-003](ADR-003-backend-platform.md) — Backend Architecture & Modular Monolith
- [ADR-006](ADR-006-api-contract.md) — API Contract & Code Generation
- [ADR-009](ADR-009-authentication-session.md) — Authentication & Session Management
- [docs/foundation/QUALITY-ATTRIBUTES.md](../../foundation/QUALITY-ATTRIBUTES.md) (`NFR-CMP-001`, `NFR-USA-003`)

## Supersedes / Superseded by

None.
