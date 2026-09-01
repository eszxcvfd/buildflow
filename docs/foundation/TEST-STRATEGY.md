# Test Strategy

## Evidence layers

| Layer | Purpose |
| --- | --- |
| Domain/application unit | State transitions, eligibility, dependency/readiness gate, blocker duration and quality gate |
| Integration | Database constraints, transaction atomicity, idempotency, file ownership and audit/notification persistence |
| Contract | Backend contracts consumed by Web and Mobile, including errors and authorization |
| Component/UI | Action availability, loading/error/empty states, keyboard/accessibility and retry feedback |
| End-to-end | Complete Plan-to-Close acceptance workflow across Web and Mobile |
| Performance/concurrency | 95th percentile response targets, 20-way self-accept and dashboard dataset target |
| Security | Role/project isolation, input/upload validation, secret handling and audit access |

## Mandatory scenario families

- main flow, alternative flow and invalid state;
- allowed and denied actor;
- missing/invalid input;
- retry and duplicate submission;
- concurrent mutation;
- cross-project access;
- history/audit preservation;
- downstream notification/report consistency.

## Critical release blockers

Any defect that permits unauthorized access, duplicate current assignment, invalid Start, bypassed Hold Point, premature Closed, incorrect blocker duration or lost inspection/rectification history blocks release.

## Test-data baseline

Use at least two projects, users with overlapping roles, active/inactive Workers, one Crew with Lead history, conflicting schedules, hard dependency, blocking/non-blocking readiness items, material shortage, Hold Point, failed Final Inspection and multiple rectification rounds.

## Proof format

Every Must requirement links to a test ID or an explicit demo step. Record command/environment, result and relevant fixture. Do not claim a runtime test for documentation-only changes.
