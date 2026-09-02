# Test Strategy

Reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md).

## Evidence layers

| Layer | Purpose |
| --- | --- |
| Domain/application unit | State transitions, eligibility (schedule interval overlap check), dependency/readiness gate, blocker duration, Crew Lead authority and quality gate |
| Integration | Database constraints (unique account/active assignment, partial indexes), transaction atomicity, idempotency, file ownership and audit/notification persistence |
| Contract | Backend contracts consumed by Web and Mobile, including CSV export, errors and authorization |
| Component/UI | Action availability, loading/error/empty states, keyboard/accessibility, Mobile Android 10+ layouts and retry feedback |
| End-to-end | Complete Plan-to-Close acceptance workflow across Web and Mobile |
| Performance/concurrency | 95th percentile response targets, 20-way self-accept and dashboard dataset target |
| Security | Role/project isolation (PM vs Coordinator separation), input/upload validation, secret handling, QC-only Hold Point release and audit access |

## Mandatory scenario families

- **Roles & Permissions**: Project Manager only, Coordinator only, user holding both roles, and denied cross-role action tests (Q-01).
- **Assignment**: Direct assignment becomes `ACTIVE` immediately upon eligibility passing; no `PENDING_ACCEPTANCE` flow in V1; self-accept 20-way concurrency with exactly one winner (Q-02).
- **Scheduling**: Non-overlapping schedule accepted; overlapping scheduled time interval rejected as a hard block for direct assignment and self-accept (Q-03, Q-04).
- **Crew Lead & Member Authority**: Fixture with Crew Lead A at assignment, changing to Lead B before Work Done: Lead B can submit Work Done, Lead A is denied after losing Lead status, and audit retains Lead A snapshot (Q-06). Non-Lead Crew Member can log progress/notes/evidence/blockers/rectifications but is denied Work Done submission (Q-05).
- **Dependency**: Unmet mandatory hard dependency blocks Start (Q-07).
- **Readiness**: Failed blocking readiness item blocks Start (`NOT_READY`); non-blocking constraint permits `READY_WITH_CONSTRAINT`; no readiness override action exists (Q-08).
- **Blocker**: Responsible party is mandatory; authorized resolve (assigned Worker/Lead, Coordinator, PM) succeeds; unauthorized resolve fails; Work Order state does not become `Blocked` (Q-09).
- **Quality Control**: PM and Coordinator cannot release Hold Point; authorized QC can inspect and release (Q-10); Must quality flow tests (Q-11).
- **Progress KPI**: `WORK_DONE` does not increase official Closed completion percentage; `CLOSED` increases completion percentage (Q-12).
- **Export**: CSV contract validation; XLSX excluded from V1 (Q-13).
- **Platform**: Mobile acceptance verification on Android 10+ (Q-14).
- **Retention**: Policy and configuration verification for 5-year retention post-project-closure (Q-15).

## Critical release blockers

Any defect that permits unauthorized access, duplicate current assignment, schedule overlap bypass, invalid Start, bypassed Hold Point, non-QC Hold Point release, premature Closed, incorrect blocker duration, lost inspection/rectification history or failure on Android 10+ blocks release.

## Test-data baseline

Use at least two projects, users with independent and combined PM/Coordinator roles, active/inactive Workers, one Crew with Lead change history, conflicting schedule intervals, hard dependencies, blocking and non-blocking readiness items, material shortage, Hold Point, failed Final Inspection, and multiple rectification rounds.

## Proof format

Every Must requirement links to a test ID or an explicit demo step. Record command/environment, result and relevant fixture. Do not claim a runtime test for documentation-only changes.
