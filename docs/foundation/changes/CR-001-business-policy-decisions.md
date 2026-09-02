# CR-001 — Approval and Reconciliation of Business Policy Decisions (Q-01 through Q-15)

Status: Approved

Requester: Product Owner / BuildFlow Project Team

Approver: Project Owner / Team

Date: 2026-09-02

## Trigger and evidence

Closure and formal approval of all 15 open business policy questions (`Q-01` through `Q-15`) documented in [OPEN-DECISIONS.md](../OPEN-DECISIONS.md) to establish an unambiguous product baseline and enable detailed module design and implementation.

## Current baseline

The initial foundation baseline was derived from draft source documents (BRD V2.0, SRS V2.1, DBD V2.1), leaving 15 policy questions in `OPEN-DECISIONS.md` in an Open status. This created blocking points for module permissions, scheduling rules, readiness evaluation, blocker ownership, quality checkpoints, KPI formulas, export formats, mobile targets, and data retention.

## Proposed change

Record the formal approval of all 15 business policy decisions and reconcile all canonical foundation documents across `docs/foundation/`:

1. **Q-01 (Roles)**: Maintain `Project Manager` and `Coordinator` as two independent roles. A user may hold both roles simultaneously. Project Manager owns project setup, membership, governance, oversight, and approved exceptions. Coordinator owns Work Order planning, scheduling, direct assignment, Job Board, and operational coordination.
2. **Q-02 (Direct Assignment Acceptance)**: Direct assignment takes effect immediately (`Coordinator assigns → eligibility passes → Assignment ACTIVE`). No `Pending Acceptance → Accept/Reject` flow exists in V1 Must baseline. Worker/Crew Lead Accept/Reject remains in Should backlog. Self-accept on Job Board continues to create an Active assignment immediately upon one-winner resolution.
3. **Q-03 (Worker Workload)**: Workload eligibility is evaluated based on **scheduled time interval overlap**. A Worker or Crew cannot have two concurrent Active assignments whose scheduled time windows overlap. Simple Work Order count is not the primary workload limit.
4. **Q-04 (Schedule Conflict)**: Schedule interval overlap is a **hard block in V1**. If a Worker or Crew has an Active assignment overlapping with a new Work Order, direct assignment and self-accept are rejected with an explicit conflict reason. Schedule override is not supported in V1 and remains in Should backlog.
5. **Q-05 (Crew Member Field Permissions)**: Non-Lead Crew Members are permitted to: view Work Orders assigned to their Crew, update progress, log field notes, upload photos/evidence, report blockers, and update assigned rectifications. Non-Lead Crew Members are strictly prohibited from submitting Work Done at the Work Order level, executing Crew-level controlled transitions, modifying assignments, releasing Hold Points, or bypassing readiness/quality gates. The Crew Lead remains the sole execution authority at the Crew level.
6. **Q-06 (Crew Lead Change)**: Work Done authorization uses the **current effective Crew Lead** at the moment the command is executed. If the Crew Lead changes from Worker A to Worker B after assignment, Worker B holds Work Done authority and Worker A loses it. The Crew Lead at assignment time is preserved as an immutable historical/audit snapshot.
7. **Q-07 (Dependency)**: V1 supports **mandatory/hard dependencies only**. If a predecessor Work Order has not met its dependency completion condition, the dependent Work Order is strictly prohibited from starting. Advisory dependencies are excluded from committed V1 scope and deferred to future backlog.
8. **Q-08 (Readiness Blocking)**: Readiness items are classified as blocking or non-blocking. If any blocking readiness item fails, overall readiness evaluates to `NOT_READY` and Start is prohibited. There is no readiness override in V1. `READY_WITH_CONSTRAINT` allows Start only when all remaining constraints are non-blocking.
9. **Q-09 (Blocker Resolution)**: `Responsible Party` is mandatory for every blocker. Blockers must record reason/category, description, responsible party, opened_by, opened_at, state, resolved_by, resolved_at, resolution note, and duration. Authorized resolvers include: assigned Worker/Crew Lead for their own Work Order constraints, Coordinator for project dispatch constraints, and Project Manager for project governance. All resolution actions are audited. Blocker resolution cannot bypass quality gates. The blocker lifecycle remains strictly independent from the Work Order execution state (no Work Order state named `Blocked`).
10. **Q-10 (Hold Point Release)**: Only authorized **QC** personnel can inspect and release a Hold Point. Project Manager, Coordinator, Worker, and Crew Lead cannot release a Hold Point. Project Managers may view and escalate, but cannot bypass QC release authority.
11. **Q-11 (Witness Point / Conditional Pass)**: `Witness Point` and `Conditional Pass` remain in the **Should backlog** and are not part of the committed V1 defense baseline. The committed Must quality flow consists of: versioned checklists, Pre-activity checkpoints, Hold Points, Final Inspections, Rectifications, Re-inspections, and Quality Close Gate.
12. **Q-12 (Project Progress)**: Official project progress in V1 is calculated strictly by Work Order completion count:
    $$\text{Progress \%} = \frac{\text{Closed Work Orders}}{\text{Total applicable Work Orders}} \times 100$$
    `WORK_DONE` confirms field execution completion only and does not count as official project completion. Field execution progress ($\text{Work Done} / \text{Total}$) may be displayed as an operational metric, but official progress requires `Closed`. Weighted duration/quantity progress is excluded from V1.
13. **Q-13 (Export)**: Basic data export in V1 supports **CSV only**. XLSX export is excluded from V1 committed scope and deferred to future backlog enhancements.
14. **Q-14 (Mobile Platform)**: Mobile release and acceptance target is **Android 10+**. iOS is excluded from the committed V1 acceptance criteria. `NFR-CMP-002` is updated from TBD to Must (Android 10+).
15. **Q-15 (Data Retention)**: Business audit records and business evidence attachments must be retained for **5 years after Project Closed**. Retention policies must be configurable. Temporary/unreferenced uploads have a separate cleanup lifecycle. Expired retention cleanup requires explicit policy and audit logging without corrupting transaction history within the active retention window.

## Classification

Correction and Must Scope Clarification (Formal baseline lock).

## Impact

- **BRD**: Clarifies role responsibilities (PM vs Coordinator), confirms Must vs Should boundaries, and locks progress metrics and export types.
- **SRS**: Updates acceptance rules and notes for IAM-SRS-005/006, ORG-SRS-008/009, PRJ-SRS-005/006/010, JOB-SRS-008/010/011/013/017/018/019/020/022/025, SCH-SRS-004/005, QUA-SRS-003/007/014/015, RPT-SRS-004/007/008.
- **Business rules/states**: Updates BR-01 through BR-21; clarifies Assignment lifecycle (direct assignment Active immediately, no V1 Pending Acceptance) and Start gate invariants.
- **Modules/contracts**: Locks public contracts for Identity & Access, Workforce, Project Setup, Work Management, Field Execution, Quality Control, and Notification & Insight.
- **Data/migration**: Enforces partial unique index for Active assignment, current vs snapshot Crew Lead, mandatory blocker responsible party, hard dependency rules, and 5-year retention policy.
- **Authorization/security**: Restricts Hold Point release to QC; enforces current Crew Lead for Work Done; locks PM/Coordinator separation; records lack of overrides in V1.
- **Web/Mobile**: Defines Web UI role views for PM and Coordinator; scopes Mobile field permissions for Crew Members; locks Mobile target to Android 10+.
- **Tests/demo**: Updates test scenario fixtures to include role separation, schedule conflict rejection, Crew Lead changeover, hard dependency blocking, QC-only Hold Point release, and Closed-based progress calculation.
- **Schedule/risk**: Eliminates design ambiguities and enables immediate commencement of Phase 1 module design.

## Alternatives

- Combining PM and Coordinator: Rejected in V1 to preserve clean separation between project governance and daily operational dispatch.
- Pending Acceptance for direct assignment: Rejected in V1 to streamline field dispatch; retained in Should backlog.
- Count-based workload limits: Rejected in favor of schedule time interval overlap checks which accurately prevent field double-booking.
- Schedule/Readiness overrides in V1: Rejected to enforce strict process compliance in the baseline.
- Advisory dependencies in V1: Deferred to backlog to maintain deterministic Start gate logic.
- iOS acceptance scope: Excluded from V1 defense commitments to focus delivery on Android 10+ field devices.

## Decision

Approved by Project Owner / Team on 2026-09-02. All 15 decisions are final and binding for BuildFlow V1.

## Documentation updates

The following canonical foundation documents have been reconciled with CR-001:

- `docs/foundation/OPEN-DECISIONS.md`
- `docs/foundation/README.md`
- `docs/foundation/PRODUCT-BASELINE.md`
- `docs/foundation/BUSINESS-RULES.md`
- `docs/foundation/WORKFLOWS-AND-STATES.md`
- `docs/foundation/REQUIREMENTS-CATALOG.md`
- `docs/foundation/DATA-BASELINE.md`
- `docs/foundation/MODULE-MAP.md`
- `docs/foundation/SECURITY-BASELINE.md`
- `docs/foundation/QUALITY-ATTRIBUTES.md`
- `docs/foundation/TRACEABILITY.md`
- `docs/foundation/TEST-STRATEGY.md`
- `docs/foundation/DELIVERY-ROADMAP.md`
- `docs/foundation/SOURCE-REGISTER.md`
- `docs/foundation/CHANGE-CONTROL.md`
