# Identity & Access Design

Status: Approved

Owner: Identity & Access

Last reviewed: 2026-09-02

## Scope and authority

- Requirements: IAM-SRS-001..008.
- Business rules: BR-18, BR-19.
- Approved decisions: CR-001/Q-01 and Q-15; ADR-007..009.
- Explicitly out of scope: business-module state, Redis, and Should-only password recovery delivery.
- This approval covers the database baseline; API details remain just-in-time work.

## Domain responsibility

- Owns: accounts, roles, role-assignment history and authentication audit inputs.
- Does not own: project membership, workforce capability or Work Order state.
- Public commands: authenticate, revoke session, manage account and role assignment.
- Public queries: current actor, roles and project-scope authorization result.

## Actors and permissions

| Operation | Actor | Project scope | Preconditions | Audit |
| --- | --- | --- | --- | --- |
| Manage account/role | Authorized administrator | Global or allowed project | Active actor and allowed role | Required |
| Authorize project action | Any authenticated actor | Active `project_members` record | Active account and role | Sensitive denials/actions |

## State and invariants

Accounts are `ACTIVE`, `INACTIVE` or `LOCKED`. Role grants retain revocation history. Project Manager and Coordinator are independent roles and one user may hold both.

## Data ownership

Owns `users`, `roles` and `user_roles`. Uses `project_members` from Project Setup. Database constraints enforce normalized unique identity, valid states and at most one active user-role pair. Authentication session tables are technical additions outside the 34-table baseline.

## Contracts

Project Setup supplies active project membership. All modules consume authorization outcomes and never infer permissions directly from clients. Retry-safe authorization is read-only; account/role changes emit audit evidence.

## Workflows

Authenticate an active account, evaluate independent system roles plus active project membership, then authorize or reject. Revocation preserves history; referenced accounts are deactivated rather than hard-deleted.

## Interfaces

Database baseline only. Later endpoints must return generic authentication failures and explicit authorization failures without exposing secrets.

## Verification

- Unit: role-combination and account-state policy.
- Integration: unique normalized email, active role uniqueness and project-scope checks.
- Contract: authorization result consumed consistently by modules.
- UI: deferred.
- End-to-end: PM-only, Coordinator-only and combined-role fixtures.
- Performance/security: credential secrecy, cross-project denial and audit proof.

## Risks and open items

Session-table shape is deferred to authentication implementation and is not part of the 34-table baseline.
