# Workforce Design

Status: Approved

Owner: Workforce

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: ORG-SRS-001..009.
- Business rules: BR-04, BR-06, BR-07, BR-18.
- Approved decisions: CR-001/Q-05 and Q-06.
- Explicitly out of scope: assignment, scheduling and Work Order transitions.
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: contractor, Trade, Worker/Crew capability, Crew membership and Crew Lead history.
- Does not own: assignment eligibility decisions or schedule conflicts.
- Public commands: manage contractors, Trades, Crews, memberships and effective Lead.
- Public queries: active resource facts, Trades and current Crew Lead.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Maintain workforce catalogs | Authorized PM/administrator | Allowed organization/project | Active actor | Required for sensitive changes |
| Read eligibility facts | Work Management | Requested project | Active resource | Correlation trace |

## State and invariants

Resources and Crews retain inactive history. A resource Trade row targets exactly one Worker or Crew. A Crew has at most one active Lead, and active membership pairs are unique.

## Data ownership

Owns `contractors`, `trades`, `resource_trades`, `crews` and `crew_members`. Partial unique indexes enforce active membership and one active Lead. Assignment snapshots remain owned by Work Management.

## Contracts

Work Management consumes active resource, Trade and current Lead facts. Lead changes do not rewrite historical assignment responsibility snapshots.

## Workflows

Maintain effective-dated memberships; close the previous active Lead before activating a replacement. Concurrent Lead changes rely on the database unique index and transaction retry.

## Interfaces

Database baseline only. Later contracts expose effective facts rather than table CRUD.

## Verification

- Unit: effective membership rules.
- Integration: owner XOR, skill range, active membership and one-Lead constraints.
- Contract: eligibility facts for Work Management.
- UI: deferred.
- End-to-end: Crew Lead replacement preserves assignment history.
- Performance/security: indexed active-resource lookup and authorized mutation.

## Risks and open items

No blocking open item.
