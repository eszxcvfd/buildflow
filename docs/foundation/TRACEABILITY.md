# Traceability

## Coverage chain

`Business objective → BRD requirement → SRS requirement → module/use case → data owner → test/demo evidence`

No Must requirement is complete when any link in this chain is missing. All links are reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md).

## Capability mapping

| Capability | BRD IDs | SRS IDs | Primary module | Main data | Acceptance focus |
| --- | --- | --- | --- | --- | --- |
| Identity and access | IAM-01..05 | IAM-SRS-001..008 | Identity & Access | users, roles, user_roles, project_members, audit_logs | PM/Coordinator role separation, project-scope isolation and authentication audit (Q-01) |
| Workforce | ORG-01..05 | ORG-SRS-001..009 | Workforce | contractors, trades, resource_trades, crews, crew_members | Active resource, effective Lead authority, Lead history snapshots, eligibility facts (Q-03, Q-06) |
| Project setup | PRJ-01..06 | PRJ-SRS-001..010 | Project Setup | projects, project_areas, project_members, work_types, dependencies | Valid project context and acyclic mandatory hard dependencies (Q-07) |
| Work management | JOB-01..18 | JOB-SRS-001..025 | Work Management + Field Execution | work_orders, assignments, readiness, blockers, materials, updates | Direct assignment Active immediately (Q-02), one-winner self-accept, Start gate without override (Q-08), independent blocker with mandatory responsible party (Q-09), Work Done by current Lead (Q-05, Q-06) |
| Scheduling | SCH-01..05 | SCH-SRS-001..007 | Work Management | work_orders, assignments, state history | Scheduled time interval overlap hard block (Q-03, Q-04), Today Jobs (override is Should backlog) |
| Quality control | QUA-01..10 | QUA-SRS-001..015 | Quality Control | checklist, checkpoint, inspection, corrective action tables | QC-exclusive Hold Point release (Q-10), Must quality flow (Q-11), quality close gate |
| Notification, reporting and audit | RPT-01..05 | RPT-SRS-001..008 | Notification & Insight | notifications, audit_logs, attachments plus source data | Permission-safe deep link, Closed-based progress calculation (Q-12), CSV export (Q-13), 5-year retention (Q-15) |

## Required end-to-end proof

1. Prepare roles (`Project Manager` only, `Coordinator` only, and dual-role user), Worker, Crew with Crew Lead history, Trades, Project, area, Work Type and quality templates.
2. Directly assign one Work Order to a Crew; demonstrate that assignment becomes `ACTIVE` immediately, and reject any assignment with overlapping scheduled time interval (hard block).
3. Publish another Work Order; two Workers concurrently self-accept; exactly one succeeds with `ACTIVE` assignment immediately and retries are idempotent.
4. Evaluate mandatory hard dependency and blocking readiness; demonstrate a blocked Start without override.
5. Record material shortage, create a supplement request, and demonstrate that shortage is not automatically blocking.
6. Record a blocker with mandatory responsible party; resolve by authorized user (assigned Worker/Lead, Coordinator, or PM) while preserving duration and execution state without creating a `Blocked` status.
7. Reach a Hold Point; demonstrate that the controlled step cannot continue before release and that only QC can release it (PM/Coordinator cannot release).
8. Change Crew Lead; demonstrate that the new active Lead holds Work Done submission authority while the former Lead loses it, and assignment snapshot preserves the original Lead for audit.
9. Submit Work Done; verify that `WORK_DONE` confirms execution completion but does NOT increment official Closed project progress.
10. Fail Final Inspection, create rectification, update/submit rectification evidence by assigned non-Lead Crew Member, and verify through an immutable re-inspection round by QC.
11. Close only after quality close gate success; verify official project progress percentage increases based on `Closed / Total`, generate CSV export, and verify audit records conform to the 5-year post-closure retention policy on Android 10+.

## Change coverage checklist

- BRD priority and scope
- SRS behaviour, exception and acceptance
- business rule and state model
- module owner and integration contract
- data owner, constraint and migration
- authorization and project scope
- retry/concurrency behaviour
- Web and Mobile consumer impact (Android 10+ target)
- unit, integration, contract and end-to-end proof
