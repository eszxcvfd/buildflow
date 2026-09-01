# System Context

## Logical system

BuildFlow is one product with:

- a Web client for administration, planning, coordination, management, dashboard and QC;
- a Mobile client for Worker, Crew Lead and field QC actions;
- one backend business boundary that owns authorization, business rules and persistence;
- a proposed PostgreSQL system of record;
- protected file/object storage for evidence and reference attachments;
- in-app notification and operational reporting based on the same business data.

No external enterprise integration is required by the current Must baseline.

## Trust boundaries

- Web and Mobile are untrusted clients. Backend revalidates identity, project scope, state, business gates and input.
- File access is authorized per project and owning business object; storage keys are not public authorization.
- Dashboard and export are subject to the same project permissions as source records.
- Audit is append-oriented and visible only to approved roles.

## Channel consistency

- Web and Mobile use one source of business truth and the same state definitions.
- A client may hide unavailable actions for usability, but backend rejection is authoritative.
- Mobile retries must be idempotent; network failure must not create duplicate assignments, updates, uploads or transitions.
- Notification deep links recheck current authorization and object state.

## Deployment assumptions not yet approved

The supplied DBD proposes one PostgreSQL database and no microservice databases. Framework, hosting platform, object-storage product, CI/CD, observability stack, authentication token strategy and production topology are not established by the business sources and must not be invented in foundation documents.

## External scope boundary

Inventory/procurement, external client portal, email/SMS, enterprise document management, BIM/CAD, payroll/accounting and full offline synchronization remain outside the baseline. Any future integration enters through change control and an explicit adapter contract.
