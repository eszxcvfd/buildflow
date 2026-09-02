# Field Execution Design

Status: Approved

Owner: Field Execution

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: JOB-SRS-017..025.
- Business rules: BR-07..12, BR-18.
- Approved decisions: CR-001/Q-05, Q-07, Q-08 and Q-09.
- Explicitly out of scope: inventory/procurement, readiness override and final closure authority.
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: readiness snapshots/items, field updates, blockers, planned material readiness and supplement requests.
- Does not own: Work Order execution state, Assignment or quality decision.
- Public commands: evaluate readiness, start coordination, report/resolve blocker, record progress/material and submit Work Done.
- Public queries: latest readiness, active blockers, execution timeline and material status.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Record field update | Assigned Worker/Crew member | Assigned project | Active Assignment | Correlated update |
| Submit Work Done | Assigned Worker/current Crew Lead | Assigned project | Authorized current responsibility | Required |
| Resolve blocker | Assigned Worker/Lead, Coordinator or PM | Allowed project | Mandatory responsible party | Required |

## State and invariants

Readiness is `READY`, `READY_WITH_CONSTRAINT` or `NOT_READY`; blocking failure prevents Start and has no override. Blockers have an independent lifecycle and mandatory responsible party/resolution evidence. Material scope excludes procurement.

## Data ownership

Owns `work_order_updates`, `work_order_readiness_checks`, `readiness_check_items`, `work_order_blockers`, `materials`, `work_order_materials` and `material_supplement_requests`. Constraints enforce attempt uniqueness, quantities, idempotency keys, responsible-party shape and resolved evidence.

## Contracts

Consumes Assignment authority, dependencies and blocking quality inputs. Produces Start/Work Done requests for Work Management and audit/notification outcomes. Mobile retries use `client_request_id` where applicable.

## Workflows

Snapshot a readiness attempt and its items; reject Start if any blocking item fails. Track blockers without changing Work Order state. A blocking supplement links a blocker but retains an independent lifecycle.

## Interfaces

Database baseline only. Later contracts return complete gate failures and idempotent retry results.

## Verification

- Unit: readiness aggregation and authority.
- Integration: attempt/client uniqueness, quantities and blocker responsible/resolution constraints.
- Contract: Start and Work Done coordination.
- UI: deferred.
- End-to-end: readiness, blocker and material supplement flows.
- Performance/security: retry safety, resolver authorization and audit.

## Risks and open items

Cross-table Start gate consistency requires one database transaction.
