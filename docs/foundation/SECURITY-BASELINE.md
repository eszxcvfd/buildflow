# Security Baseline

Reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md).

## Required properties

- Authenticate every protected request and support explicit session invalidation/expiry.
- Enforce role and active project scope at backend read and write boundaries, distinguishing `Project Manager` and `Coordinator` roles (Q-01 / CR-001).
- Prevent identifier/URL manipulation from exposing another project.
- Store passwords only with an appropriate salted password-hashing mechanism; never log credentials, reset codes or tokens.
- Encrypt authenticated and business-data transport in deployed environments.
- Validate type, length, range and format at input boundaries.
- Validate uploaded type, size, safe name, owner existence and project scope.
- Rate-limit or lock out repeated failed sign-in attempts according to approved configuration.
- Whitelist audit before/after fields; exclude secrets and file bytes.
- Use short-lived signed access or an authorization endpoint for protected files.
- Retain business audit records and evidence attachments for 5 years after Project Closed under a configurable policy (Q-15 / CR-001).

## Sensitive operations

Assignment, reassignment, blocker resolution, Hold Point release (QC-only), Work Done submission (assigned Worker or current effective Crew Lead), quality close, account/role changes and destructive lifecycle actions require explicit backend permission checks and audit evidence. (Schedule overrides and readiness overrides are not supported in V1).

## Security design gates

- Identity & Access implements independent `Project Manager` and `Coordinator` roles with project-scoped authorization (Q-01 / CR-001).
- Hold Point release is strictly restricted to authenticated and authorized QC personnel (Q-10 / CR-001).
- Work Done authorization checks current active Crew Lead at execution time while preserving assignment-time snapshot for audit (Q-06 / CR-001).
- Blocker resolution requires authenticated authorization (assigned Worker/Lead, Coordinator, or PM) and generates an audit trail (Q-09 / CR-001).
- Data retention is governed by the 5-year post-project-closure policy with configurable cleanup lifecycles (Q-15 / CR-001).
- Authentication/session details are selected during technical design and recorded in technical ADRs.

## Verification

Include authorization matrix tests, cross-project access attempts, invalid transition tests, concurrent/retry tests, upload abuse cases, secret/log inspection and notification deep-link reauthorization.
