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
| Project Manager | Web | Project setup, membership, oversight and approved exceptions. |
| Coordinator | Web | Work planning, scheduling, direct assignment, Job Board and constraint coordination. |
| QC | Web and Mobile | Checkpoint queue, inspection, Hold Point release, rectification and re-inspection. |
| Worker | Mobile | Job Board, self-accept, readiness, field updates, blockers, material readiness and Work Done for personal assignments. |
| Crew Lead | Mobile | Crew-level responsibility, readiness, updates and Work Done for crew assignments. |
| Crew Member | Mobile | Only field updates explicitly authorized by the unresolved policy; never assume Work Done authority. |

## Committed Must scope

- Identity, account status, role and project-scoped authorization.
- Worker, contractor, trade/skill, Crew, Crew Lead and dated membership.
- Project, area/category, Work Type, project membership and Work Order dependency.
- Work Order lifecycle, scheduling, direct assignment and Job Board self-accept with one-winner concurrency.
- My Jobs/Today Jobs, eligibility and schedule-conflict checks.
- Pre-start readiness with Ready, Ready With Constraint and Not Ready.
- Independent blocker lifecycle with cause, responsible party, timing and resolution.
- Planned material, material readiness, shortage and simple supplement request tied to a Work Order.
- Versioned checklist, Pre-activity inspection, Hold Point, Final Inspection, rectification, re-inspection and quality close gate.
- In-app notifications, operational dashboard, drill-down KPI and audit trail.
- One demonstrable end-to-end Web and Mobile workflow using shared state and data.

## Should scope

Password reset; Work Order templates; basic reference files; optional acceptance/rejection of direct assignments; controlled withdrawal; manual pause/resume; schedule overload warning/override; plan-versus-actual and return visit; Witness Point; Conditional Pass; basic export.

Should work starts only after the complete Must flow is stable and tested.

## Explicitly out of scope

- Multi-tenant operation.
- Inventory, warehouse, purchasing, suppliers, PO/VPO, receipt, pricing, invoice, payment, payroll and accounting.
- Enterprise NCR/CAPA/root-cause management.
- Full RFI/Submittal, BIM/CAD and advanced document versioning.
- Full HSE/incident management, continuous GPS/geofence, route optimization and payroll attendance.
- Real-time chat, email/SMS automation, client portal and digital signature.
- Full offline synchronization and algorithmic resource optimization.

## Non-negotiable invariants

- One Work Order has at most one current main assignment.
- A Crew assignment requires one active Crew Lead.
- Self-accept has one winner and is retry-safe.
- Hard dependency, blocking checklist and blocking pre-activity conditions gate Start.
- A blocker does not overwrite the Work Order execution state.
- A material shortage does not automatically block work; blocking requires an explicit blocker.
- Hold Point blocks the controlled step until authorized release.
- Historical assignment, membership, state, inspection and rectification evidence is not silently overwritten or hard-deleted.
- Authorization is enforced at the backend and by project scope.
