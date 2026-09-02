# <Module Name> Design

Status: Draft

Owner: TBD

Last reviewed: TBD

## Scope and authority

- Requirements:
- Business rules:
- Approved decisions:
- Explicitly out of scope:

## Domain responsibility

- Owns:
- Does not own:
- Public commands:
- Public queries:

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |

## State and invariants

List states, legal transitions, gate conditions and invariants. Do not add a state merely for UI presentation.

## Data ownership

List owned records, history/snapshot needs, database constraints, transaction rules and retention dependency.

## Contracts

For each dependency or consumer: owner, request/outcome, errors, retry/idempotency, versioning and test adapter.

## Workflows

Describe main, alternative, failure, concurrent and retry flows.

## Interfaces

Define observable request/response/error semantics. Add endpoint, event and schema detail only after behaviour is stable.

## Verification

- Unit:
- Integration:
- Contract:
- UI:
- End-to-end:
- Performance/security:

## Risks and open items

Only non-blocking implementation risks belong here. Product decisions remain in `OPEN-DECISIONS.md`.
