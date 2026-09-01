# Workflows and State Models

## End-to-end workflow

1. Administrator prepares accounts, Workforce data, Trades, Crews and Crew Lead history.
2. Project Manager creates the Project, areas, members and approved Work Types.
3. Coordinator creates Work Orders, schedules, dependencies, planned materials and applicable quality controls.
4. Work Management either directly assigns a Worker/Crew or publishes an eligible Work Order to the Job Board.
5. The responsible Worker/Crew Lead evaluates readiness. Hard unmet conditions prevent Start.
6. Field execution records progress, evidence, blockers and material shortages without collapsing independent lifecycles into one status.
7. The authorized responsible person submits Work Done.
8. QC executes mandatory checkpoints, Final Inspection, rectification and re-inspection.
9. Quality Control confirms the close gate; Work Management transitions the Work Order to Closed.
10. Authorized users inspect dashboard, KPI, notifications and audit evidence.

## Work Order execution state

`Draft → Ready → Open | Assigned → In Progress → Work Done → Closed`

Exceptional terminal state: `Cancelled`.

- Draft cannot be assigned or published.
- Open means published on Job Board and unassigned.
- Assigned means one current assignment exists.
- In Progress requires Start gate success.
- Work Done is execution completion only.
- Closed requires the quality close gate.
- Every exceptional transition requires authorization, reason where applicable and history.

The exact transition table must be finalized in the Work Management module design; no implementation may invent extra states such as Blocked.

## Assignment

`Pending Acceptance → Active → Ended | Withdrawn | Rejected`

- Pending Acceptance applies only if open decision Q-02 selects that policy.
- Self-accept creates Active immediately.
- At most one Pending Acceptance or Active assignment may exist for a Work Order.
- Reassign/withdraw preserves previous assignee, responsible snapshot, actor, time and reason.

## Readiness

`Not Checked → Ready | Ready With Constraint | Not Ready`

- Not Ready blocks Start.
- Ready allows Start if no independent blocking quality condition exists.
- Ready With Constraint allows Start only if no constraint is blocking.
- A new assessment creates a new attempt; prior attempts remain traceable.

## Blocker

`Open → Acknowledged → Resolving → Resolved`, or `Cancelled`.

- It is independent from Work Order execution state.
- Duration is from opened time to resolved time, or current time while open.
- Resolution does not silently change the execution state.

## Material supplement

`Requested → Acknowledged → In Progress → Fulfilled`, or `Cancelled`.

- It is not a purchasing or approval lifecycle.
- Shortage does not block automatically.
- When it truly blocks execution, a separate material blocker is linked.

## Inspection checkpoint

Baseline checkpoint types: Pre-activity, Hold Point and Final.

Runtime reference: `Pending → Ready for Inspection → In Progress → Released | Failed | Cancelled`.

- A blocking Pre-activity checkpoint can prevent Ready/Start.
- A Hold Point prevents its controlled step until Released.
- Witness Point is Should and must not be treated as committed.

## Inspection and rectification

Inspection: `Pending → In Progress → Pass | Fail`.

Rectification: `Open → In Progress → Submitted → Verified`, with `Rejected → In Progress`.

- Each inspection/re-inspection is a separate round.
- Fail creates at least one rectification.
- Conditional Pass is Should and still requires open rectification to be verified before Closed.

## Notification

`Unread → Read`.

Notification state never changes its source Work Order, blocker, inspection, rectification or material request.
