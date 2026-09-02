# Data Baseline

DBD-CWM-QC-002 V2.1 proposes PostgreSQL 15+ and one shared physical database, formally reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md). This remains a proposed physical baseline until approved and implemented through reviewed migrations.

## Ownership catalog

| Module | Tables |
| --- | --- |
| Identity & Access | `users`, `roles`, `user_roles`, `project_members` |
| Workforce | `contractors`, `trades`, `resource_trades`, `crews`, `crew_members` |
| Project Setup | `projects`, `project_areas`, `work_types`, `work_order_dependencies` |
| Work Management | `work_orders`, `assignments`, `work_order_state_history` |
| Field Execution | `work_order_updates`, `work_order_readiness_checks`, `readiness_check_items`, `work_order_blockers`, `materials`, `work_order_materials`, `material_supplement_requests` |
| Quality Control | `checklist_templates`, `checklist_template_items`, `checklist_instances`, `checklist_instance_items`, `inspection_checkpoint_templates`, `inspection_checkpoints`, `inspections`, `corrective_actions` |
| Notification & Insight | `attachments`, `notifications`, `audit_logs` |

The source classifies 26 tables as business tables and 8 as support tables. The physical baseline contains 34 tables. Framework tables such as refresh tokens, device tokens, idempotency requests, outbox/jobs and migration history are excluded until a concrete technical need exists.

## Global conventions

- UUID primary keys and `snake_case` plural table names.
- `timestamptz` stored and compared in UTC; project timezone controls local display/interpretation.
- Referenced history uses status/inactivity rather than destructive deletion.
- Sensitive transitions update the current record, history, audit and required notification reliably as one application operation.
- Backend authorization uses role plus active project membership, strictly distinguishing `Project Manager` and `Coordinator` capabilities (Q-01 / CR-001).
- Completed checklist and inspection data is versioned or superseded, never silently rewritten.
- Retention policy: `audit_logs` and business evidence `attachments` are retained for 5 years after Project Closed (`projects.status = 'CLOSED'`) under a configurable policy (Q-15 / CR-001). Temporary/unreferenced uploads have a separate cleanup lifecycle.

## Database-enforceable invariants

- Unique normalized account identity.
- One active Crew Lead per Crew.
- One active membership for each Crew/Worker and Project/User pair.
- One current assignment per Work Order through a partial unique index covering `status = 'ACTIVE'`. (Any schema fields for `PENDING_ACCEPTANCE` represent future extension space only and are not part of committed V1 behavior - Q-02 / CR-001).
- Self-dependency and direct cycles in `work_order_dependencies` are rejected; full graph-cycle detection is an application rule. V1 enforces mandatory hard dependencies only (Q-07 / CR-001).
- Positive quantities, valid ranges and mutually exclusive Worker/Crew references use checks where feasible.
- Mandatory `responsible_party` fields on `work_order_blockers` (Q-09 / CR-001).
- History and audit data are append-oriented.

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
- Each migration is forward, reviewed, ordered by dependency and paired with rollback/recovery notes appropriate to its risk.
- Seed only approved roles, catalog examples and demo data; do not encode unresolved policy as seed truth.
- Verify constraints with concurrency and invalid-data tests, not only successful migration execution.
