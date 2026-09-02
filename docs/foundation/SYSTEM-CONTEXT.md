# System Context

## Logical system

BuildFlow is a unified product with:

- a **Web client** (Next.js 16 / React / TypeScript per [ADR-004](../architecture/adr/ADR-004-web-platform.md)) for administration, planning, coordination, management, dashboard and QC;
- a **Mobile client** (React Native / Expo SDK 57 / TypeScript targeting Android 10+ per [ADR-005](../architecture/adr/ADR-005-mobile-platform.md)) for Worker, Crew Lead, Crew Member and field QC actions;
- one **NestJS backend** boundary ([ADR-003](../architecture/adr/ADR-003-backend-platform.md)) structured as a Modular Monolith that owns authentication, authorization, business rules and persistence;
- a **PostgreSQL 18.x** system of record ([ADR-007](../architecture/adr/ADR-007-postgresql-database.md)) managed via Prisma ORM 7.x ([ADR-008](../architecture/adr/ADR-008-prisma-migrations.md));
- protected **S3-compatible object storage** (MinIO local/demo baseline per [ADR-010](../architecture/adr/ADR-010-attachment-storage.md)) for evidence and reference attachments;
- in-app notification and operational reporting based on domain business data.

No external enterprise integration is required by the current Must baseline.

## Trust boundaries

- Web and Mobile are untrusted clients. Backend revalidates identity, project scope, state, business gates and input.
- File access is authorized per project and owning business object; storage keys are not public authorization.
- Dashboard and export are subject to the same project permissions as source records.
- Audit is append-oriented and visible only to approved roles.

## Channel consistency

- Web and Mobile consume the same REST `/api/v1` contract via the generated TypeScript client ([ADR-006](../architecture/adr/ADR-006-api-contract.md)).
- A client may hide unavailable actions for usability, but backend rejection is authoritative.
- Mobile retries must be idempotent; network failure must not create duplicate assignments, updates, uploads or transitions.
- Notification deep links recheck current authorization and object state.

## Deployment and platform topology

As accepted in [ADR-014](../architecture/adr/ADR-014-deployment-platform.md), BuildFlow is deployed via Docker Compose on a Linux VPS fronted by Caddy reverse proxy (automated HTTPS). All internal services (PostgreSQL 18, MinIO S3, NestJS API, Next.js Web) run within an isolated Docker network.

## External scope boundary

Inventory/procurement, external client portal, email/SMS, enterprise document management, BIM/CAD, payroll/accounting and full offline synchronization remain outside the baseline. Any future integration enters through change control and an explicit adapter contract.
