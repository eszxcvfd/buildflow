# Workflows and State Models

## End-to-end workflow

1. Administrator prepares accounts, Workforce data, Trades, Crews and Crew Lead history.
2. Project Manager creates the Project, areas, members and approved Work Types.
3. Coordinator creates Work Orders, schedules, mandatory hard dependencies, planned materials and applicable quality controls.
4. Work Management either directly assigns a Worker/Crew (Active immediately) or publishes an eligible Work Order to the Job Board (Self-accept Active immediately).
5. The responsible Worker/Crew Lead evaluates readiness. Any failed blocking readiness item results in `NOT_READY` and strictly prevents Start.
6. Field execution records progress, evidence, blockers (with mandatory responsible party) and material shortages without collapsing independent lifecycles into one status.
7. The authorized responsible person (assigned Worker or current effective Crew Lead) submits Work Done.
8. QC executes mandatory checkpoints, Hold Point releases, Final Inspection, rectification and re-inspection.
9. Quality Control confirms the close gate; Work Management transitions the Work Order to Closed.
10. Authorized users inspect dashboard, KPI (official progress based on Closed count), notifications and audit evidence.

## Work Order execution state

`Draft → Ready → Open | Assigned → In Progress → Work Done → Closed`

Exceptional terminal state: `Cancelled`.

- `Draft` cannot be assigned or published.
- `Open` means published on Job Board and unassigned.
- `Assigned` means one current `Active` assignment exists.
- `In Progress` requires Start gate success (hard dependencies met, readiness passed, blocking checklists/pre-activity checkpoints satisfied; no override).
- `Work Done` is execution completion only (submitted by assigned Worker or current effective Crew Lead).
- `Closed` requires the quality close gate.
- Every exceptional transition requires authorization, reason where applicable and history.

The exact transition table must be finalized in the Work Management module design; no implementation may invent extra states such as `Blocked`.

## Assignment

V1 committed flow:

- Direct assignment: `Coordinator Assign → Eligibility passes → Active`
- Self-accept: `Job Board → Self-accept → Active`

Lifecycle transitions:

`Active → Ended | Withdrawn | Rejected`

- Direct assignment takes effect immediately (`ACTIVE`) in V1; no `PENDING_ACCEPTANCE` state exists in the V1 Must baseline.
- `Pending Acceptance → Accept/Reject` is Should/future extension only — not part of V1 committed flow.
- Self-accept creates `ACTIVE` immediately upon winning one-winner resolution.
- Exactly one `ACTIVE` assignment may exist for a Work Order at a given time.
- Reassign/withdraw preserves previous assignee, responsible snapshot, actor, time and reason.

## Readiness

`Not Checked → Ready | Ready With Constraint | Not Ready`

- `Not Ready` (from any failed blocking readiness item) blocks Start; no readiness override exists in V1.
- `Ready` allows Start if no independent blocking quality condition exists.
- `Ready With Constraint` allows Start only if all remaining constraints are non-blocking.
- A new assessment creates a new attempt; prior attempts remain traceable.

## Blocker

`Open → Acknowledged → Resolving → Resolved`, or `Cancelled`.

- It is independent from Work Order execution state (never replaces execution state with `Blocked`).
- Every blocker requires a mandatory `Responsible Party`.
- Duration is from opened time to resolved time, or current time while open.
- Authorized resolvers include: assigned Worker/Crew Lead for their own Work Order, Coordinator for project dispatch, and Project Manager for project governance.
- Resolution requires audit logging and does not silently change the execution state or bypass quality gates.

## Material supplement

`Requested → Acknowledged → In Progress → Fulfilled`, or `Cancelled`.

- It is not a purchasing or approval lifecycle.
- Shortage does not block automatically.
- When it truly blocks execution, a separate material blocker is linked.

## Inspection checkpoint

Baseline checkpoint types: Pre-activity, Hold Point and Final.

Runtime reference: `Pending → Ready for Inspection → In Progress → Released | Failed | Cancelled`.

- A blocking Pre-activity checkpoint prevents Ready/Start.
- A Hold Point strictly prevents its controlled step until released exclusively by authorized QC. Project Manager, Coordinator, Worker, and Crew Lead cannot release Hold Points.
- Witness Point is Should backlog and not part of the committed V1 defense baseline.

## Inspection and rectification

Inspection: `Pending → In Progress → Pass | Fail`.

Rectification: `Open → In Progress → Submitted → Verified`, with `Rejected → In Progress`.

- Each inspection/re-inspection is a separate immutable round.
- Fail creates at least one rectification item.
- Conditional Pass is Should backlog and not part of the committed V1 defense baseline; any rectification must still be verified before Closed.

## Notification

`Unread → Read`.

Notification state never changes its source Work Order, blocker, inspection, rectification or material request.
