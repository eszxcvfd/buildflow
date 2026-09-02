# Security Baseline

Reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md) and technical architecture decisions ([ADR-009](../architecture/adr/ADR-009-authentication-session.md), [ADR-010](../architecture/adr/ADR-010-attachment-storage.md)).

## Required properties

- Authenticate every protected request and support explicit session invalidation/expiry.
- Enforce role and active project scope at backend read and write boundaries, distinguishing `Project Manager` and `Coordinator` roles (Q-01 / CR-001).
- Prevent identifier/URL manipulation from exposing another project.
- Store passwords only with an appropriate salted password-hashing mechanism (e.g. Argon2 / bcrypt); never log credentials, reset codes or tokens.
- Encrypt authenticated and business-data transport via TLS in deployed environments (ADR-014).
- Validate type, length, range and format at input boundaries using DTOs and Zod schemas (ADR-006).
- Validate uploaded type, size, safe name, owner existence and project scope before persisting attachment metadata.
- Rate-limit or lock out repeated failed sign-in attempts according to approved configuration.
- Whitelist audit before/after fields; exclude secrets and file bytes.
- Use short-lived signed access or an authorization endpoint for protected files (ADR-010).
- Retain business audit records and evidence attachments for 5 years after Project Closed under a configurable policy (Q-15 / CR-001).

## Sensitive operations

Assignment, reassignment, blocker resolution, Hold Point release (QC-only), Work Done submission (assigned Worker or current effective Crew Lead), quality close, account/role changes and destructive lifecycle actions require explicit backend permission checks and audit evidence. (Schedule overrides and readiness overrides are not supported in V1).

## Security architecture baseline

- **Authentication Authority**: Owned strictly by the NestJS Backend (`apps/api`); no third-party identity authority (ADR-009).
- **Session & Token Strategy**: Short-lived JWT access token + rotating refresh token hashed server-side and persisted in PostgreSQL `sessions` table (ADR-009).
- **Client Security**: Web uses `HttpOnly`, `Secure`, `SameSite=Lax/Strict` cookies; Mobile uses hardware-backed `expo-secure-store` (ADR-009).
- **Immediate Revocation**: Logout, password change, or administrative lockout revokes session records in PostgreSQL immediately (ADR-009).
- **Attachment Protection**: Binary media stored in private S3-compatible storage (MinIO); access requires backend authorization and presigned URLs (ADR-010).
- **Identity & Access**: Implements independent `Project Manager` and `Coordinator` roles with project-scoped authorization (Q-01 / CR-001).
- **Hold Point Release**: Strictly restricted to authenticated and authorized QC personnel (Q-10 / CR-001).
- **Work Done Authority**: Validates current active Crew Lead at execution time while preserving assignment-time snapshot for audit (Q-06 / CR-001).
- **Blocker Resolution**: Requires authenticated authorization (assigned Worker/Lead, Coordinator, or PM) and generates an audit trail (Q-09 / CR-001).
- **Data Retention**: Governed by the 5-year post-project-closure policy with configurable cleanup lifecycles (Q-15 / CR-001).

## Verification

Include authorization matrix tests, cross-project access attempts, invalid transition tests, concurrent/retry tests, upload abuse cases, secret/log inspection and notification deep-link reauthorization.
