# Business Rules

This normalized rule list comes from SRS V2.1, checked against BRD V2.0 and formally reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md).

| ID | Rule | Binding statement |
| --- | --- | --- |
| BR-01 | Hybrid dispatch | A Work Order may be directly assigned or published for Worker self-accept; direct assignment takes effect immediately (`ACTIVE`) upon passing eligibility checks without a secondary acceptance step in V1. |
| BR-02 | Immediate self-accept | An eligible Worker accepts an available Work Order immediately without manager approval; creates an `ACTIVE` assignment immediately upon one-winner resolution. |
| BR-03 | One main assignment | A Work Order has only one `ACTIVE` assignment at a time, to either a Worker or a Crew; no `PENDING_ACCEPTANCE` state exists in the V1 baseline. |
| BR-04 | Shared eligibility & schedule hard-block | A resource must be active and satisfy Trade, project scope, and scheduled time interval non-overlap checks; schedule interval conflict is a hard block without override in V1. |
| BR-05 | One concurrent winner | Concurrent self-accept requests create exactly one `ACTIVE` assignment; retries create no duplicate. |
| BR-06 | Effective Crew Lead & history | A Crew used for assignment has one active Crew Lead; assignment-time Crew Lead is captured as an immutable historical/audit snapshot. |
| BR-07 | Execution confirmation authority | Personal assignment: assigned Worker submits Work Done. Crew assignment: current effective Crew Lead at execution time submits Work Done; non-Lead members can log progress/notes/evidence/blockers/rectifications but cannot submit Work Done. |
| BR-08 | Mandatory dependency gate | An unmet mandatory hard predecessor dependency strictly prevents Start; no advisory dependencies or Start overrides exist in V1. |
| BR-09 | Readiness gate & no override | `NOT_READY` (from any failed blocking readiness item) blocks Start; `READY` permits Start; `READY_WITH_CONSTRAINT` permits Start only when all remaining constraints are non-blocking; no readiness override exists in V1. |
| BR-10 | Independent blocker & mandatory responsible party | Blocked/on-hold condition is represented by an independent blocker entity (not a Work Order execution state); every blocker requires a mandatory responsible party. |
| BR-11 | Blocker resolution & duration trace | Blockers retain category, description, responsible party, opened_by/at, state, resolved_by/at, resolution note, and duration; authorized resolvers (assigned Worker/Lead, Coordinator, PM) must be audited; blocker resolution does not bypass quality gates. |
| BR-12 | Work Order material boundary | Material scope is planned material, readiness and supplement request only; shortage does not automatically block and does not introduce procurement/inventory. |
| BR-13 | Blocking checklist | A blocking checklist item must pass before the related Start or transition. |
| BR-14 | Hold Point QC exclusivity | The controlled work step cannot continue until authorized QC inspection and release; PM, Coordinator, Worker, and Crew Lead cannot release Hold Points. |
| BR-15 | Work Done is not Closed | Work Done confirms field execution only; Closed follows the quality gate; official project progress metric is strictly calculated as `Closed / Total Work Orders × 100`. |
| BR-16 | Quality close gate & Should scope | Mandatory checkpoint, Final Inspection and rectification conditions must pass/be verified before Closed; Witness Point and Conditional Pass remain Should backlog outside committed V1 defense baseline. |
| BR-17 | Historical reassignment | Reassign, withdraw and cancel retain reason, prior assignee, actor and timing. |
| BR-18 | Preserve business history & retention | Referenced transaction/evidence data is not hard-deleted; business audit records and evidence attachments are retained for 5 years after Project Closed under a configurable policy. |
| BR-19 | Role and project authorization | Backend checks every view/action against role and project scope; `Project Manager` and `Coordinator` are independent roles with distinct responsibilities; a user may hold both. |
| BR-20 | Notification isolation | Reading or deleting a notification never changes the source business object. |
| BR-21 | Consistent time | Schedule, transition, audit and KPI use consistent storage/comparison and an explicit display timezone. |

## Rule application

- Every sensitive transition checks actor, current state, relevant gates and idempotency.
- Cross-record rules are application/transaction rules unless the database can enforce them safely.
- When two rules appear to conflict, record a new open decision `OQ-###` and follow [CHANGE-CONTROL.md](CHANGE-CONTROL.md); do not weaken either rule silently.
- Approved exceptions require explicit authority, reason and audit evidence.
