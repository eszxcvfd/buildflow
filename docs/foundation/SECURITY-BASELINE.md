# Security Baseline

## Required properties

- Authenticate every protected request and support explicit session invalidation/expiry.
- Enforce role and active project scope at backend read and write boundaries.
- Prevent identifier/URL manipulation from exposing another project.
- Store passwords only with an appropriate salted password-hashing mechanism; never log credentials, reset codes or tokens.
- Encrypt authenticated and business-data transport in deployed environments.
- Validate type, length, range and format at input boundaries.
- Validate uploaded type, size, safe name, owner existence and project scope.
- Rate-limit or lock out repeated failed sign-in attempts according to approved configuration.
- Whitelist audit before/after fields; exclude secrets and file bytes.
- Use short-lived signed access or an authorization endpoint for protected files.

## Sensitive operations

Assignment, reassignment, readiness override, blocker resolution, schedule override, Hold Point release, Work Done, quality close, account/role changes and destructive lifecycle actions require explicit permission checks and audit evidence.

## Security design gates

- Identity & Access design must resolve Q-01 and define the role/action/project matrix.
- Any override must define actor, reason, expiry/effect and audit record.
- Data retention and attachment disposal wait for Q-15.
- Authentication/session details are selected during technical design and recorded separately; no source currently approves a specific token scheme.

## Verification

Include authorization matrix tests, cross-project access attempts, invalid transition tests, concurrent/retry tests, upload abuse cases, secret/log inspection and notification deep-link reauthorization.
