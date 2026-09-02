# Data Baseline

Governed by approved change record [CR-001](changes/CR-001-business-policy-decisions.md) and technical architecture decisions [ADR-007](../architecture/adr/ADR-007-postgresql-database.md) (PostgreSQL 18.x), [ADR-008](../architecture/adr/ADR-008-prisma-migrations.md) (Prisma 7.x), [ADR-009](../architecture/adr/ADR-009-authentication-session.md) (Session Persistence), [ADR-010](../architecture/adr/ADR-010-attachment-storage.md) (Object Storage), and [ADR-011](../architecture/adr/ADR-011-redis-deferred.md) (Redis Deferred).

## Ownership catalog

| Module | Tables |
| --- | --- |
| Identity & Access | `users`, `roles`, `user_roles` |
| Workforce | `contractors`, `trades`, `resource_trades`, `crews`, `crew_members` |
| Project Setup | `projects`, `project_areas`, `project_members`, `work_types`, `work_order_dependencies` |
| Work Management | `work_orders`, `assignments`, `work_order_state_history` |
| Field Execution | `work_order_updates`, `work_order_readiness_checks`, `readiness_check_items`, `work_order_blockers`, `materials`, `work_order_materials`, `material_supplement_requests` |
| Quality Control | `checklist_templates`, `checklist_template_items`, `checklist_instances`, `checklist_instance_items`, `inspection_checkpoint_templates`, `inspection_checkpoints`, `inspections`, `corrective_actions` |
| Notification & Insight | `attachments`, `notifications`, `audit_logs` |

The physical database baseline comprises exactly 34 tables: 26 business tables
and 8 system-support tables. Technical tables such as refresh-token sessions
and Prisma migration history are additional implementation tables and are not
counted in the 34-table DBD baseline. `project_members` is produced by Project
Setup and consumed by Identity & Access for project-scoped authorization.
Redis is explicitly deferred from V1 (ADR-011); all session state and business
data reside in PostgreSQL.

## Global conventions

- **Engine**: PostgreSQL 18.x (single physical database for the Modular Monolith per ADR-007).
- **ORM & Migrations**: Prisma ORM 7.x + Prisma Migrate (ADR-008).
- **Primary Keys**: UUID primary keys and `snake_case` plural table names.
- **Timestamps**: `timestamptz` stored and compared in UTC; project timezone controls local display/interpretation.
- **History Preservation**: Referenced history uses status/inactivity rather than destructive deletion.
- **Transactional Atomicity**: Sensitive transitions update current records, history, audit and notifications reliably as one ACID database transaction.
- **Authorization Scope**: Backend authorization uses role plus active project membership, strictly distinguishing `Project Manager` and `Coordinator` capabilities (Q-01 / CR-001).
- **Quality Immutability**: Completed checklist and inspection data is versioned or superseded, never silently overwritten.
- **Binary vs Metadata Separation**: File binaries are stored in S3-compatible object storage (MinIO for dev/demo per ADR-010); PostgreSQL `attachments` table stores only metadata, ownership links, MIME types, and storage keys.
- **Data Retention**: `audit_logs` and business evidence `attachments` are retained for 5 years after Project Closed (`projects.status = 'CLOSED'`) under a configurable policy (Q-15 / CR-001). Temporary/unreferenced uploads have a separate cleanup lifecycle.

## Database-enforceable invariants

- Unique normalized account identity.
- One active Crew Lead per Crew.
- One active membership for each Crew/Worker and Project/User pair.
- One current assignment per Work Order through a partial unique index covering `status = 'ACTIVE'` (implemented via reviewed migration SQL in Prisma per ADR-008). Any schema fields for `PENDING_ACCEPTANCE` represent future extension space only and are not part of committed V1 behavior (Q-02 / CR-001).
- Self-dependency and direct cycles in `work_order_dependencies` are rejected; full graph-cycle detection is an application rule. V1 enforces mandatory hard dependencies only (Q-07 / CR-001).
- Positive quantities, valid ranges and mutually exclusive Worker/Crew references use checks where feasible.
- Mandatory `responsible_party` fields on `work_order_blockers` (Q-09 / CR-001).
- History, session revocations, and audit data are append-oriented.

## Application/transaction invariants

- Eligibility is rechecked inside the assignment transaction, including scheduled time-interval overlap hard-block verification (Q-03, Q-04 / CR-001).
- Direct assignment creates an `ACTIVE` assignment immediately upon passing eligibility checks (Q-02 / CR-001).
- Self-accept locks/checks the Work Order and treats unique-conflict as “already accepted”.
- Start gate evaluates hard dependencies, readiness checks (blocking items without override), blocking checklists and pre-activity checkpoints together (Q-07, Q-08 / CR-001).
- Material shortage creates a blocker only when explicitly marked blocking.
- Work Done authorization verifies against the current effective Crew Lead at execution time, while `responsible_user_id` preserves the immutable assignment-time Lead snapshot for audit (Q-06 / CR-001).
- Hold Point release is exclusively authorized for QC roles (Q-10 / CR-001).
- Quality close checks all mandatory checkpoint, Final Inspection and rectification conditions, then records Closed atomically (Q-11, Q-12 / CR-001).

## Deliberate design risks and extension headspace

- `attachments.owner_type/owner_id` is polymorphic and has no direct foreign key; the service must validate target existence and project scope.
- `responsible_user_id` snapshots responsibility at assignment time for audit; runtime execution authority dynamically queries current active Crew Lead (Q-06 / CR-001).
- Schema columns/enums supporting optional direct-assignment acceptance, advisory dependency, readiness override, Witness Point and Conditional Pass represent extension compatibility space only; they are not active in the committed V1 Must baseline.
- Notification and audit reliability may require technical tables not counted in the baseline.
- Final DDL names, lengths, indexes and deletion actions must be validated against actual queries and migrations.

## Migration policy

- Never generate migrations from the obsolete V1 data model.
- Each migration is managed through Prisma Migrate (`apps/api/prisma/migrations/`), forward-only, reviewed, ordered by dependency and paired with rollback/recovery notes appropriate to its risk.
- PostgreSQL-specific features (partial unique indexes, check constraints) are integrated via reviewed migration SQL files.
- Seed only approved roles, catalog examples and demo data; do not encode unresolved policy as seed truth.
- Verify constraints with concurrency and invalid-data tests against real PostgreSQL, not only successful migration execution.
