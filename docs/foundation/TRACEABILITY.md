# Traceability

## Coverage chain

`Business objective → BRD requirement → SRS requirement → module/use case → data owner → test/demo evidence`

No Must requirement is complete when any link in this chain is missing.

## Capability mapping

| Capability | BRD IDs | SRS IDs | Primary module | Main data | Acceptance focus |
| --- | --- | --- | --- | --- | --- |
| Identity and access | IAM-01..05 | IAM-SRS-001..008 | Identity & Access | users, roles, user_roles, project_members, audit_logs | Role/project isolation and authentication audit |
| Workforce | ORG-01..05 | ORG-SRS-001..009 | Workforce | contractors, trades, resource_trades, crews, crew_members | Active resource, one Lead, eligibility facts |
| Project setup | PRJ-01..06 | PRJ-SRS-001..010 | Project Setup | projects, project_areas, project_members, work_types, dependencies | Valid project context and acyclic dependency |
| Work management | JOB-01..18 | JOB-SRS-001..025 | Work Management + Field Execution | work_orders, assignments, readiness, blockers, materials, updates | One-winner, Start gate, independent constraints and Work Done |
| Scheduling | SCH-01..05 | SCH-SRS-001..007 | Work Management | work_orders, assignments, state history | Time overlap, Today Jobs and approved override policy |
| Quality control | QUA-01..10 | QUA-SRS-001..015 | Quality Control | checklist, checkpoint, inspection, corrective action tables | Hold Point and quality close |
| Notification, reporting and audit | RPT-01..05 | RPT-SRS-001..008 | Notification & Insight | notifications, audit_logs plus source data | Permission-safe deep link, drill-down equality and audit |

## Required end-to-end proof

1. Prepare users, roles, Worker, Crew/Crew Lead, Trades, Project, area, Work Type and quality templates.
2. Directly assign one Work Order to a Crew.
3. Publish another Work Order; two Workers concurrently self-accept and exactly one succeeds.
4. Evaluate dependency/readiness and demonstrate a blocked Start.
5. Record material shortage, create a supplement request and demonstrate that shortage is not automatically blocking.
6. Record and resolve a blocker while preserving duration and execution state.
7. Reach a Hold Point and demonstrate that the controlled step cannot continue before release.
8. Submit Work Done without closing the Work Order.
9. Fail Final Inspection, create rectification, submit evidence, reject or verify through a separate re-inspection round.
10. Close only after quality gate success; verify dashboard drill-down, notification context and audit timeline.

## Change coverage checklist

- BRD priority and scope
- SRS behaviour, exception and acceptance
- business rule and state model
- module owner and integration contract
- data owner, constraint and migration
- authorization and project scope
- retry/concurrency behaviour
- Web and Mobile consumer impact
- unit, integration, contract and end-to-end proof
