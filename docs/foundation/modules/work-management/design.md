# Work Management Design

Status: Approved

Owner: Work Management

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: JOB-SRS-001..016, JOB-SRS-025 and SCH-SRS-001..007.
- Business rules: BR-01..07, BR-15, BR-17, BR-21.
- Approved decisions: CR-001/Q-02, Q-03, Q-04, Q-06 and Q-12.
- Explicitly out of scope: readiness, blockers, quality evidence and Should-only acceptance/override flows.
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: Work Order, schedule, Job Board, Assignment and execution-state history.
- Does not own: resource facts, readiness outcome or quality close decision.
- Public commands: create/publish/update Work Order, assign, self-accept, reassign and transition execution state.
- Public queries: Job Board, My Jobs, schedule and current responsibility.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Plan/publish/assign | PM or Coordinator per policy | Active membership | Valid project/resource facts | Required |
| Self-accept | Worker | Active membership | Eligible and Job Board open | Required |
| Submit Work Done transition | Assigned Worker/current Crew Lead via Field Execution | Assigned project | Valid authority and state | Required |

## State and invariants

Work Order execution uses `DRAFT`, `READY`, `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `WORK_DONE`, `CLOSED`, `CANCELLED`. Exactly one `ACTIVE` Assignment exists per Work Order. Direct assignment and winning self-accept become `ACTIVE` immediately. Schedule overlap is a hard block without override.

## Data ownership

Owns `work_orders`, `assignments` and `work_order_state_history`. Database constraints enforce state domains, assignee XOR, ordered schedules, progress range and one active Assignment. `responsible_user_id` preserves assignment-time responsibility.

## Contracts

Consumes Workforce eligibility facts and Project Setup scope/dependencies. Coordinates Start/Work Done/Closed with Field Execution and Quality Control. Retry uses client/correlation IDs and unique-conflict as the one-winner result.

## Workflows

Plan then publish or assign. Self-accept rechecks eligibility and inserts `ACTIVE` inside one transaction. Reassignment ends prior history before creating a new active row. State change and history/audit are atomic.

## Interfaces

Database baseline only. Later contracts return explicit invalid-state, ineligible, schedule-conflict and already-assigned errors.

## Verification

- Unit: state transitions and authority.
- Integration: assignee XOR, one-active partial index and history FKs.
- Contract: producer/consumer transition outcomes.
- UI: deferred.
- End-to-end: direct assignment, self-accept and reassignment.
- Performance/security: 20-way one-winner concurrency and project authorization.

## Risks and open items

Schedule-overlap enforcement requires transactional application queries; the database partial index only protects one active Assignment per Work Order.
