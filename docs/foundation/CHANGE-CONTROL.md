# Requirement Change Control

## When this process applies

Use it for a new business rule, changed priority, new state/transition, altered permission, scope addition, data-retention change, KPI formula or any change that affects an approved requirement.

## Workflow

1. Create a change record from [templates/CHANGE-REQUEST-TEMPLATE.md](templates/CHANGE-REQUEST-TEMPLATE.md) in `docs/foundation/changes/`.
2. Assign a stable ID `CR-###` and list the triggering evidence.
3. Identify impacted BRD/SRS/rules/states/modules/data/tests and out-of-scope boundaries.
4. Classify the change as clarification, correction, Must scope change or Should/backlog.
5. Obtain the named business/product approval; technical convenience is not approval.
6. Update affected canonical documents, traceability and open decisions together.
7. If implementation exists, add migration/backfill, compatibility and rollout/rollback notes.
8. Merge only when documentation and implementation proof agree.

## Registered change records

| ID | Title | Status | Date | Approver | File |
| --- | --- | --- | --- | --- | --- |
| CR-001 | Approval and Reconciliation of Business Policy Decisions (Q-01 through Q-15) | Approved | 2026-09-02 | Project Owner / Team | [CR-001](changes/CR-001-business-policy-decisions.md) |

## Conflict policy

- Do not edit only the nearest document.
- Do not resolve a conflict by choosing the newest file timestamp.
- Do not let DBD or code create a business rule absent from BRD/SRS.
- Keep the prior requirement visible through version history; never rewrite provenance.

## Stable identifiers

Existing BRD, SRS, rule and question IDs are never recycled. A removed item is marked superseded/withdrawn and links to the change record.
