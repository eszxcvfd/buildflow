# Data Baseline

DBD-CWM-QC-002 V2.1 proposes PostgreSQL 15+ and one shared physical database. This remains a proposed design until approved and implemented through reviewed migrations.

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

## Proposed global conventions

- UUID primary keys and `snake_case` plural table names.
- `timestamptz` stored and compared in UTC; project timezone controls local display/interpretation.
- Referenced history uses status/inactivity rather than destructive deletion.
- Sensitive transitions update the current record, history, audit and required notification reliably as one application operation.
- Backend authorization uses role plus active project membership.
- Completed checklist and inspection data is versioned or superseded, never silently rewritten.

## Database-enforceable invariants

- Unique normalized account identity.
- One active Crew Lead per Crew.
- One active membership for each Crew/Worker and Project/User pair.
- One current assignment per Work Order through a partial unique index covering Pending Acceptance/Active as applicable.
- Self-dependency and direct cycles are rejected; full graph-cycle detection is an application rule.
- Positive quantities, valid ranges and mutually exclusive Worker/Crew references use checks where feasible.
- History and audit data are append-oriented.

## Application/transaction invariants

- Eligibility is rechecked inside the assignment transaction.
- Self-accept locks/checks the Work Order and treats unique-conflict as “already accepted”.
- Start gate evaluates dependencies, readiness, blocking checklist and pre-activity checkpoint together.
- Material shortage creates a blocker only when explicitly marked blocking.
- Work Done authorization uses the approved Crew Lead policy while retaining the assignment snapshot.
- Quality close checks all mandatory checkpoint, Final Inspection and rectification conditions, then records Closed atomically.

## Deliberate design risks requiring module review

- `attachments.owner_type/owner_id` is polymorphic and has no direct foreign key; the service must validate target existence and project scope.
- `responsible_user_id` snapshots responsibility but Q-06 still decides current-versus-snapshot authorization.
- Schema supports optional direct-assignment acceptance, advisory dependency, readiness override, Witness Point and Conditional Pass; support in schema does not promote them to Must.
- Notification and audit reliability may require technical tables not counted in the baseline.
- Final DDL names, lengths, indexes and deletion actions must be validated against actual queries and migrations.

## Migration policy

- Never generate migrations from the obsolete V1 data model.
- Each migration is forward, reviewed, ordered by dependency and paired with rollback/recovery notes appropriate to its risk.
- Seed only approved roles, catalog examples and demo data; do not encode unresolved policy as seed truth.
- Verify constraints with concurrency and invalid-data tests, not only successful migration execution.
