# Product Baseline

## Product intent

BuildFlow is a single-company platform for VINACON to plan, dispatch, make ready, execute, inspect, rectify and close construction Work Orders. It must make current responsibility, readiness, constraints and quality gates observable from one traceable workflow.

## Core value stream

`Plan → Dispatch → Make Ready → Execute → Manage Constraints → Inspect → Rectify → Close`

Work Done confirms that field execution is complete. It never means Closed. Closed is allowed only after every mandatory quality gate is satisfied.

## Users and channels

| Persona | Primary channel | Primary responsibility |
| --- | --- | --- |
| Administrator | Web | Accounts, roles, workforce master data and system governance. |
| Project Manager | Web | Project setup, membership, governance, oversight and approved management exceptions. (Independent role from Coordinator; user may hold both). |
| Coordinator | Web | Work Order planning, scheduling, direct assignment, Job Board, operational and constraint coordination. (Independent role from PM; user may hold both). |
| QC | Web and Mobile | Checkpoint queue, inspection, exclusive Hold Point release, rectification and re-inspection. |
| Worker | Mobile | Job Board, self-accept, readiness, field updates, blockers, material readiness and Work Done for personal assignments. |
| Crew Lead | Mobile | Crew-level responsibility, readiness, updates, blocker reporting and Work Done for crew assignments. |
| Crew Member | Mobile | View Crew Work Orders, update progress, field logs, photos/evidence, report blockers, and update assigned rectifications. Strictly prohibited from submitting Work Done, altering assignments, or releasing Hold Points. |

## Committed Must scope

- Identity, account status, role and project-scoped authorization (with independent `Project Manager` and `Coordinator` roles).
- Worker, contractor, trade/skill, Crew, Crew Lead and dated membership.
- Project, area/category, Work Type, project membership and mandatory hard dependency.
- Work Order lifecycle, scheduling, direct assignment (Active immediately upon passing eligibility), and Job Board self-accept with one-winner concurrency.
- My Jobs/Today Jobs, eligibility and time-interval schedule conflict hard-block checks.
- Pre-start readiness with Ready, Ready With Constraint (non-blocking constraints only) and Not Ready; no readiness override in V1.
- Independent blocker lifecycle with cause, mandatory responsible party, timing, authorized resolution and duration trace.
- Planned material, material readiness, shortage and simple supplement request tied to a Work Order (shortage does not auto-block).
- Versioned checklist, Pre-activity inspection, Hold Point (QC-only release), Final Inspection, rectification, re-inspection and quality close gate.
- In-app notifications, operational dashboard, drill-down KPI (official project progress calculated as `Closed / Total Work Orders × 100`) and audit trail.
- Basic data export in CSV format.
- Mobile release and acceptance target on Android 10+.
- Business audit records and evidence attachments retained for 5 years after Project Closed.
- One demonstrable end-to-end Web and Mobile workflow using shared state and data.

## Should scope

Password reset; Work Order templates; basic reference files; optional acceptance/rejection of direct assignments; controlled withdrawal; manual pause/resume; schedule overload warning/override; advisory dependency; readiness override; plan-versus-actual and return visit; Witness Point; Conditional Pass; basic XLSX export.

Should work starts only after the complete Must flow is stable and tested.

## Explicitly out of scope

- Multi-tenant operation.
- Inventory, warehouse, purchasing, suppliers, PO/VPO, receipt, pricing, invoice, payment, payroll and accounting.
- Enterprise NCR/CAPA/root-cause management.
- Full RFI/Submittal, BIM/CAD and advanced document versioning.
- Full HSE/incident management, continuous GPS/geofence, route optimization and payroll attendance.
- Real-time chat, email/SMS automation, client portal and digital signature.
- Full offline synchronization and algorithmic resource optimization.
- iOS platform release/acceptance commitments for V1.

## Non-negotiable invariants

- One Work Order has at most one current main assignment (Active).
- Direct assignment takes effect immediately (`ACTIVE`) upon passing eligibility checks without a secondary acceptance step in V1.
- A Crew assignment requires one active Crew Lead; Work Done authorization uses the current effective Crew Lead at execution time while preserving assignment-time Lead snapshots for audit.
- Workload eligibility and schedule conflict checks enforce a time-interval overlap hard block.
- Self-accept has one winner and is retry-safe.
- Mandatory hard dependency, blocking checklist and blocking pre-activity conditions gate Start without override in V1.
- A blocker requires a mandatory responsible party and does not overwrite the Work Order execution state (no state named `Blocked`).
- A material shortage does not automatically block work; blocking requires an explicit blocker.
- Hold Point blocks the controlled step until authorized QC release; PM/Coordinator/Worker/Crew Lead cannot release Hold Points.
- Official project progress requires `Closed` status; `WORK_DONE` does not increment official completion count.
- Historical assignment, membership, state, inspection and rectification evidence is not silently overwritten or hard-deleted.
- Business audit and evidence records are retained for 5 years after Project Closed under a configurable policy.
- Authorization is enforced at the backend and by project scope.
