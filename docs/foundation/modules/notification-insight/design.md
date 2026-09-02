# Notification & Insight Design

Status: Approved

Owner: Notification & Insight

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: RPT-SRS-001..008 plus shared evidence metadata requirements.
- Business rules: BR-15, BR-18, BR-20.
- Approved decisions: CR-001/Q-12, Q-13 and Q-15; ADR-010 and ADR-011.
- Explicitly out of scope: source-state mutation, XLSX export and binary storage in PostgreSQL.
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: attachment metadata, notification read state and Audit Trail storage/read surface.
- Does not own: source business state or KPI source records.
- Public commands: record notification/audit/evidence metadata and mark notification read.
- Public queries: authorized notification inbox, audit trail, dashboard/drill-down and CSV export.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Read notification | Recipient | Reauthorized source context | Active recipient | Read state only |
| Access attachment/audit | Authorized project actor | Owning project | Backend owner/scope validation | Required for sensitive access |

## State and invariants

Notification read state never mutates its source. Audit is append-oriented. Attachment owner is polymorphic and validated by the service. Official progress is `Closed / Total applicable Work Orders × 100`; export is CSV only.

## Data ownership

Owns `attachments`, `notifications` and `audit_logs`. PostgreSQL stores metadata only; binaries remain in private S3-compatible storage. Business evidence and audit retention is five years after Project Closed.

## Contracts

All modules produce stable outcomes with actor/project/correlation context. Notification deep links reauthorize. Retry uses notification `dedup_key`; audit writes are transactionally coordinated with source outcomes.

## Workflows

Consume a committed business outcome, append audit and notification records, authorize evidence access, and derive permission-safe dashboard/CSV results from source tables.

## Interfaces

Database baseline only. Later contracts must preserve drill-down equality and project authorization.

## Verification

- Unit: KPI and retention policy.
- Integration: storage/dedup uniqueness and append-only usage.
- Contract: producer outcome and deep-link authorization.
- UI: deferred.
- End-to-end: notification to authorized source and CSV export.
- Performance/security: project isolation, signed access and audit payload allow-list.

## Risks and open items

Polymorphic attachment ownership cannot be enforced by a single FK and requires service validation.
