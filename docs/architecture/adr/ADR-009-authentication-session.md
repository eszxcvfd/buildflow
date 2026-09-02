# ADR-009 — Authentication & Session Management

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow enforces strict role-based and project-scoped access control across Web and Mobile clients. Roles include Administrator, Project Manager, Coordinator, QC, Worker, Crew Lead, and Crew Member. The authentication mechanism must prevent credential leakage, support immediate session revocation/expiry on logout or account deactivation, protect against token theft, and ensure seamless operation on both Web browsers and Mobile devices.

## Decision

Authentication, session authority, and authorization are **strictly owned by the NestJS Backend (`apps/api`)**.

### Authentication Architecture

1. **Short-Lived Access Token**:
   - JWT signed with a secure secret or asymmetric key.
   - Short expiration window (e.g. 15 minutes).
   - Contains minimal claims: `userId`, `roles`, `tokenVersion`/`sessionId`.
2. **Rotating Refresh Token & Server Session**:
   - Long-lived cryptographically secure random token (e.g. 7 days).
   - Every refresh request invalidates the old refresh token and issues a new pair (token rotation).
   - The refresh token is **hashed on the server** (e.g. SHA-256) and stored in the PostgreSQL database (`sessions` / `refresh_tokens` table) alongside client device info, IP, and expiration timestamp.
3. **Client-Specific Storage**:
   - **Web (`apps/web`)**: The refresh token is stored in an **`HttpOnly`**, **`Secure`**, **`SameSite=Lax/Strict`** cookie. The short-lived access token is stored in browser memory (React state / closure) and refreshed via standard cookie rotation. Access tokens are never written to unencrypted `localStorage` or `sessionStorage`.
   - **Mobile (`apps/mobile`)**: The refresh credentials are encrypted and stored using **`expo-secure-store`** (hardware-backed Android Keystore).
4. **Session Revocation & Logout**:
   - Logout calls `/api/v1/iam/auth/logout`, immediately marking the session record in PostgreSQL as revoked / deleted, rendering any present refresh token permanently invalid.
   - Account deactivation, password change, or security lockouts immediately revoke all active sessions in PostgreSQL.
5. **Backend-Enforced Authorization**:
   - Every protected API request validates identity and checks project membership and role permissions at backend boundary guards (`JwtAuthGuard`, `ProjectScopeGuard`, `RolesGuard`).

## Alternatives considered

- **NextAuth.js / Auth.js**: Rejected. Auth.js is tightly coupled to Next.js and splits identity authority between Web and API, creating major friction when authenticating Mobile Expo clients.
- **Pure Stateless JWTs without server session table**: Rejected. Pure stateless JWTs cannot be revoked immediately upon logout, account compromise, or administrative lockout before natural JWT expiry.
- **Third-Party Managed Auth (Auth0 / Firebase Auth / Supabase Auth)**: Rejected. Introduces unnecessary cloud billing dependencies and external vendor lock-in for a self-hosted corporate system.

## Consequences

### Positive

- Complete control over identity, session lifecycles, and audit logging.
- Immediate revocation capabilities for active sessions on compromise or logout.
- High security posture: Web protected against XSS-based token theft via `HttpOnly` cookies; Mobile protected via hardware keystore.
- Unified backend authentication endpoint servicing both Web and Mobile identical API contracts.

### Negative / trade-offs

- Requires maintaining session database records and periodically running cleanup jobs for expired sessions.

## Constraints

- Authentication authority belongs solely to NestJS; Next.js must never implement a separate identity provider.
- Refresh tokens must be hashed before storage in PostgreSQL.

## Related requirements / documents

- [docs/foundation/SECURITY-BASELINE.md](../../foundation/SECURITY-BASELINE.md)
- [docs/foundation/REQUIREMENTS-CATALOG.md](../../foundation/REQUIREMENTS-CATALOG.md) (`IAM-SRS-001` through `IAM-SRS-008`)
- [ADR-003](ADR-003-backend-platform.md) — Backend Architecture & Modular Monolith
- [ADR-004](ADR-004-web-platform.md) — Web Frontend Architecture
- [ADR-005](ADR-005-mobile-platform.md) — Mobile Platform Architecture

## Supersedes / Superseded by

None.
