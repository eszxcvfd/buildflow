# Open Decisions

All items are Open unless an approved change or decision record says otherwise. Schema flexibility is not a decision.

| ID | Decision required | Affected design | Blocking point |
| --- | --- | --- | --- |
| Q-01 | Keep Project Manager and Coordinator separate or combine them in V1? | Role matrix, project membership, authorization and UI navigation | Before Identity & Access and Project Setup permission design |
| Q-02 | Does direct assignment require Worker/Crew Lead Accept/Reject or become Active immediately? | Assignment state, notifications, My Jobs and DBD status use | Before Work Management state/API design |
| Q-03 | How is concurrent Worker workload limited: count, time interval or no limit? | Eligibility and scheduling | Before assignment eligibility is finalized |
| Q-04 | Is a schedule conflict a hard block or may Coordinator override with reason? | JOB-SRS-008 versus optional SCH-SRS-005 policy | Before direct/self-assignment acceptance tests |
| Q-05 | Which updates may a non-Lead Crew member perform? | Progress, log, photo and rectification authorization | Before Mobile field actions |
| Q-06 | After Crew Lead changes, does Work Done authority use current Lead or the assignment snapshot? | Authorization, audit and reassignment | Before Crew Work Done implementation |
| Q-07 | Does baseline support advisory dependency or only hard dependency? | Dependency type, readiness and UI | Before Project/Work Management dependency design |
| Q-08 | Which readiness items are blocking and who can override them? | Start gate, audit and role matrix | Before Field Execution Start gate |
| Q-09 | Who can resolve a blocker, and is responsible party mandatory? | Blocker lifecycle, assignment and KPI | Before blocker command design |
| Q-10 | Who may release Hold Point: QC, Project Manager or per-Work-Type role? | Checkpoint authorization | Before Quality Control interface |
| Q-11 | Are Witness Point and Conditional Pass committed for the defense or only Should backlog? | Quality scope and demo | Before Should work is scheduled |
| Q-12 | Is project progress counted by Work Orders or weighted by duration/quantity? | KPI formula and dashboard acceptance | Before dashboard metric implementation |
| Q-13 | Is export CSV, XLSX or both? | Export contract and dependency choice | Before RPT-SRS-007 |
| Q-14 | Is Mobile Android-only or Android+iOS? | Release targets, testing devices and NFR-CMP-002 | Before Mobile release design |
| Q-15 | How long are audit records, images and attachments retained? | Storage lifecycle, cleanup and backup | Before retention jobs/deployment |

## Detected ambiguity controls

- SRS requires schedule-conflict checking while also leaving override policy open. Until Q-04 is approved, implement neither silent override nor an undocumented permanent hard-block contract.
- SRS and BRD define Crew Lead authority but leave Lead-change semantics open. Preserve snapshots now; defer authorization choice to Q-06.
- DBD prepares fields/enums for several Should/open options. Those fields are compatibility space, not scope approval.
- The Mobile source contains an Android 10+ recommendation but explicitly marks the platform as TBD. Treat it only as a proposal.
- DBD retention values are proposals for a demo environment; they do not close Q-15.

## Decision completion rule

A decision is complete only when it records: selected option, rationale, approver, effective date, affected requirement IDs, affected documents and migration/backfill impact. Update this register and all affected canonical files in the same change.
