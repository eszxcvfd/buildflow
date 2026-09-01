# Business Rules

This normalized rule list comes from SRS V2.1 and is checked against BRD V2.0.

| ID | Rule | Binding statement |
| --- | --- | --- |
| BR-01 | Hybrid dispatch | A Work Order may be directly assigned or published for Worker self-accept; both use the same state, capability and schedule principles. |
| BR-02 | Immediate self-accept | An eligible Worker accepts an available Work Order immediately without a second manager approval. |
| BR-03 | One main assignment | A Work Order has only one Active assignment at a time, to either a Worker or a Crew. |
| BR-04 | Shared eligibility | A resource must be active and satisfy Trade, project scope, schedule and configured-limit checks. |
| BR-05 | One concurrent winner | Concurrent self-accept requests create one Active assignment; retries create no duplicate. |
| BR-06 | Effective Crew Lead | A Crew used for assignment has one active Crew Lead; Lead history is preserved. |
| BR-07 | Execution confirmation authority | Personal assignment: assigned Worker submits Work Done. Crew assignment: authorized Crew Lead submits; ordinary members do not. |
| BR-08 | Dependency gate | An unmet mandatory dependency prevents Start unless an approved and audited exception policy exists. |
| BR-09 | Readiness gate | Not Ready blocks Start; Ready permits Start; Ready With Constraint permits Start only without blocking constraints. |
| BR-10 | Independent blocker | Blocked/on-hold meaning is represented by a separate blocker, not by replacing the Work Order execution state. |
| BR-11 | Blocker duration trace | Blockers retain reason, responsible party, opened/resolved times and duration. |
| BR-12 | Work Order material boundary | Material scope is planned material, readiness and supplement request only; shortage does not automatically block and does not introduce procurement/inventory. |
| BR-13 | Blocking checklist | A blocking checklist item must pass before the related Start or transition. |
| BR-14 | Hold Point | The controlled work step cannot continue until authorized QC inspection and release. |
| BR-15 | Work Done is not Closed | Work Done confirms field execution only; Closed follows the quality gate. |
| BR-16 | Quality close gate | Mandatory checkpoint, Final Inspection and rectification conditions must pass/be verified before Closed. |
| BR-17 | Historical reassignment | Reassign, withdraw and cancel retain reason, prior assignee, actor and timing. |
| BR-18 | Preserve business history | Referenced transaction/evidence data is not hard-deleted; status or inactivity preserves history. |
| BR-19 | Role and project authorization | Backend checks every view/action against role and project scope. |
| BR-20 | Notification isolation | Reading or deleting a notification never changes the source business object. |
| BR-21 | Consistent time | Schedule, transition, audit and KPI use consistent storage/comparison and an explicit display timezone. |

## Rule application

- Every sensitive transition checks actor, current state, relevant gates and idempotency.
- Cross-record rules are application/transaction rules unless the database can enforce them safely.
- When two rules appear to conflict, record an open decision and block the affected detailed design; do not weaken either rule silently.
- Approved exceptions require explicit authority, reason and audit evidence.
