# Quality Control Design

Status: Approved

Owner: Quality Control

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: QUA-SRS-001..015.
- Business rules: BR-13..16, BR-18.
- Approved decisions: CR-001/Q-10 and Q-11.
- Explicitly out of scope: Witness Point and Conditional Pass Must behavior, planning and Assignment mutation.
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: checklist templates/snapshots, checkpoint templates/instances, immutable inspection rounds and Rectifications.
- Does not own: Work Order planning or applying the final `CLOSED` transition.
- Public commands: configure quality controls, inspect/reinspect, release Hold Point and verify Rectification.
- Public queries: inspection queue, checkpoint evidence and quality-gate result.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Maintain templates | Authorized PM/QC | Allowed project/catalog | Active role | Required |
| Inspect/release Hold Point | Authorized QC only | Assigned project | Required checkpoint/role | Required |
| Submit Rectification | Assigned Worker/Crew member | Assigned project | Open item | Correlated evidence |

## State and invariants

Checklist template and instance histories are preserved. Inspection rounds are unique and never overwritten. Only QC may release a Hold Point. Mandatory checkpoints, Final Inspection and Rectifications must satisfy the quality gate before Closed.

## Data ownership

Owns `checklist_templates`, `checklist_template_items`, `checklist_instances`, `checklist_instance_items`, `inspection_checkpoint_templates`, `inspection_checkpoints`, `inspections` and `corrective_actions`. Constraints enforce version/sequence/round uniqueness, assignee XOR and value ranges.

## Contracts

Consumes Work Type/Work Order context and Assignment authority. Produces blocking checkpoint facts for Start and a quality-gate outcome for Work Management. Notifications/audit observe results without mutating them.

## Workflows

Instantiate versioned templates, request inspection, append a new round, create Rectifications on failure, reinspect, then report gate satisfaction. Hold Point release is QC-only and audited.

## Interfaces

Database baseline only. Later contracts expose immutable round outcomes and complete unmet-gate reasons.

## Verification

- Unit: quality-gate and QC authority.
- Integration: sequence/round uniqueness, assignee XOR and snapshot persistence.
- Contract: Start blocker and Closed-gate outcome.
- UI: deferred.
- End-to-end: Pre-activity, Hold Point, Final, Rectification and reinspection.
- Performance/security: non-QC release denial and evidence authorization.

## Risks and open items

Witness/Conditional fields are compatibility headroom only and must not activate Should behavior in V1.
