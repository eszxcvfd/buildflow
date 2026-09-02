# Open Decisions

All initial business policy decisions (Q-01 through Q-15) have been formally approved and resolved via [CR-001](changes/CR-001-business-policy-decisions.md).

## Resolved decisions register

| ID | Status | Approved decision | Effective date | Change record |
| --- | --- | --- | --- | --- |
| Q-01 | Approved | Keep `Project Manager` and `Coordinator` as independent roles; a user can hold both. PM owns setup, governance, oversight and exceptions; Coordinator owns planning, scheduling, direct assignment, Job Board and operations. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-02 | Approved | Direct assignment takes effect immediately (`ACTIVE`) upon passing eligibility checks. No `Pending Acceptance` flow in V1 baseline (Accept/Reject remains Should backlog). Self-accept creates `ACTIVE` immediately upon one-winner resolution. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-03 | Approved | Worker/Crew workload eligibility is based on **scheduled time interval overlap**. No two concurrent Active assignments may have overlapping scheduled time windows. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-04 | Approved | Schedule interval overlap is a **hard block** for direct assignment and self-accept in V1. Schedule override is not supported in V1 and remains Should backlog. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-05 | Approved | Non-Lead Crew Members can view Crew Work Orders, update progress, log notes, upload evidence, report blockers, and update assigned rectifications. Non-Lead members cannot submit Work Done, execute controlled transitions, change assignments, release Hold Points, or bypass quality gates. Crew Lead is the execution authority. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-06 | Approved | Work Done authorization uses the **current effective Crew Lead** at execution time. Assignment-time Crew Lead is preserved as an immutable historical/audit snapshot. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-07 | Approved | V1 supports **mandatory/hard dependencies only**. Unmet dependency prevents Start. Advisory dependencies are excluded from committed V1 scope. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-08 | Approved | Readiness items are classified as blocking or non-blocking. Failed blocking item results in `NOT_READY` and prohibits Start. No readiness override in V1. `READY_WITH_CONSTRAINT` allows Start only if all remaining constraints are non-blocking. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-09 | Approved | `Responsible Party` is mandatory for blockers. Blockers retain category, description, responsible party, opened_by/at, state, resolved_by/at, note, and duration. Authorized resolvers: assigned Worker/Lead (their work), Coordinator (dispatch), PM (project governance). Audited resolution. Blocker does not bypass quality gates; no Work Order state named `Blocked`. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-10 | Approved | Only authorized **QC** can release Hold Points. PM, Coordinator, Worker, and Crew Lead cannot release Hold Points. PM can view/escalate but cannot bypass QC. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-11 | Approved | `Witness Point` and `Conditional Pass` remain in **Should backlog** and are not part of the committed V1 defense baseline. Must quality flow includes checklists, Pre-activity, Hold Point, Final Inspection, Rectification, Re-inspection, and Quality Close Gate. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-12 | Approved | Official project progress is calculated by Work Order count: `Progress % = Closed Work Orders / Total applicable Work Orders * 100`. `WORK_DONE` confirms execution only and is not official project completion. Weighted duration/quantity progress is excluded from V1. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-13 | Approved | Basic data export in V1 is **CSV only**. XLSX export is excluded from V1 committed scope (future enhancement). | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-14 | Approved | Mobile acceptance/release target is **Android 10+**. iOS is excluded from committed V1 acceptance scope. `NFR-CMP-002` is updated to Must (Android 10+). | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |
| Q-15 | Approved | Business audit records and evidence attachments are retained for **5 years after Project Closed**. Configurable policy with audited cleanup lifecycle; temporary/unreferenced upload cleanup is separate. | 2026-09-02 | [CR-001](changes/CR-001-business-policy-decisions.md) |

## Resolved policy notes

- Schedule conflict checking enforces a deterministic time-interval hard-block contract in V1; no schedule override is permitted (Q-04).
- Crew Lead authority follows current active Lead for command authorization while preserving assignment-time snapshots for audit (Q-06).
- Database schema flexibility fields/enums represent extension headroom and do not alter committed V1 behavior.
- Mobile platform baseline is committed as Android 10+ (Q-14).
- Data retention is governed by the 5-year post-project-closure policy (Q-15).

## Decision completion rule

Any future open question must be registered with a new stable identifier `OQ-###` and approved through [CHANGE-CONTROL.md](CHANGE-CONTROL.md). No remaining business-policy decisions from Q-01 through Q-15.
