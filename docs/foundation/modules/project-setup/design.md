# Project Setup Design

Status: Approved

Owner: Project Setup

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: PRJ-SRS-001..010.
- Business rules: BR-08, BR-18, BR-19, BR-21.
- Approved decisions: CR-001/Q-01 and Q-07.
- Explicitly out of scope: Work Order execution, advisory dependencies and Work Order templates (Should).
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: projects, areas, project membership, Work Types and mandatory dependency definitions.
- Does not own: assignment, readiness result or inspection execution.
- Public commands: maintain project context, membership, catalogs and dependencies.
- Public queries: valid project scope, Work Type defaults and predecessor facts.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Maintain project setup | Project Manager | Managed project | Active membership | Required |
| Consume project context | Authorized module | Same project | Active project/member | Correlation trace |

## State and invariants

Project dates are ordered; area codes are unique per project; active project membership is unique per user/project. Dependencies cannot reference themselves or duplicate a pair; full cycle and same-project checks remain transactional service rules. V1 dependencies are mandatory.

## Data ownership

Owns `projects`, `project_areas`, `project_members`, `work_types` and `work_order_dependencies`. Work Order foreign keys are owned by Work Management; dependency creation coordinates with it.

## Contracts

Identity & Access consumes active project membership. Work Management consumes project, area, Work Type and dependency facts. Errors distinguish inactive scope, invalid pair and cycle.

## Workflows

Create project context and membership, maintain catalogs, then add validated mandatory predecessor relationships. Retry of the same dependency is rejected by uniqueness.

## Interfaces

Database baseline only. Later contracts must enforce same-project membership and dependency-cycle validation.

## Verification

- Unit: project lifecycle and dependency policy.
- Integration: date, uniqueness, self-dependency and FK constraints.
- Contract: membership authorization and Work Type lookup.
- UI: deferred.
- End-to-end: project setup before Work Order creation.
- Performance/security: project-scoped indexes and cross-project denial.

## Risks and open items

Full graph-cycle detection is an application transaction rule, not a SQL CHECK.
