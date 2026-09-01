# Delivery Roadmap

Detailed design is just in time. A phase may be planned at overview level, but its module design is completed immediately before implementation and reviewed against all upstream requirements.

## Phase 1 — Business foundation

Scope: Identity & Access, Workforce and Project Setup.

Exit gate: approved role/project matrix; active Worker/Crew/Crew Lead rules; Project/area/Work Type setup; Q-01 resolved; test data ready.

## Phase 2 — Planning and dispatch

Scope: Work Order, dependency, schedule, direct assignment, Job Board, self-accept and My Jobs.

Exit gate: Q-02, Q-03, Q-04, Q-06 and Q-07 resolved; one-winner concurrency proof; reassignment history; permission tests.

## Phase 3 — Make ready and execution

Scope: readiness, Start gate, blockers, progress/log/evidence, Work Order material and Work Done.

Exit gate: Q-05, Q-08 and Q-09 resolved; dependency/readiness/checklist gate proof; blocker duration; retry-safe field updates; no procurement scope leakage.

## Phase 4 — Quality close

Scope: checklist, Pre-activity, Hold Point, Final Inspection, rectification, re-inspection and Closed gate.

Exit gate: Q-10 resolved; immutable inspection rounds; Hold Point proof; Work Done-versus-Closed proof; quality close integration tests.

## Phase 5 — Operations and acceptance

Scope: notifications, dashboard/KPI, drill-down, audit, performance evidence, backup/restore and end-to-end demo.

Exit gate: Q-12, Q-14 and Q-15 resolved; KPI formula fixtures; security and performance evidence; complete Web/Mobile demo.

## Should work

Only schedule Should requirements after all Must exits above are stable. Each Should enters through change control and cannot weaken Must proof.
