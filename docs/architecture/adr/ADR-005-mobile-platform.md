# ADR-005 — Mobile Platform Architecture

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

The Mobile channel serves Workers, Crew Leads, Crew Members, and on-site QC engineers directly on the construction site. It enables viewing My Jobs / Job Board, self-accepting work, logging readiness, reporting blockers, capturing photographic evidence, submitting Work Done, and performing on-site QC inspections/rectifications. The mobile client must be lightweight, responsive on mobile hardware, and strictly aligned with backend authority.

## Decision

We adopt **React Native** with **Expo SDK 57** using **Expo Router** and **TypeScript**.

### Technology Stack

- **Framework**: **React Native** + **Expo SDK 57** (using **Expo Router** for file-based navigation).
- **Language**: TypeScript (strict mode).
- **Server State & Networking**: **TanStack Query** (React Query) consuming the generated TypeScript API client.
- **Form Management & Validation**: **React Hook Form** + **Zod**.
- **Client State**: **Zustand** for lightweight local UI, user session, and navigation state.
- **Secure Storage**: **`expo-secure-store`** for storing session refresh credentials securely on-device.
- **Camera & Media**: **`expo-camera`** / **`expo-image-picker`** for capturing and uploading inspection photos and field blocker evidence.
- **In-App / System Notifications**: **`expo-notifications`** where applicable.

### Release and Acceptance Scope

- **Platform Target**: **Android 10+ only** (conforming to `NFR-CMP-002` and `CR-001/Q-14`).
- **iOS Scope**: While Expo technically supports iOS, iOS is **explicitly excluded** from committed V1 release, testing, and acceptance requirements.
- **Backend Authority**: Mobile is a pure client consumer. It holds no local business rules and connects only to the NestJS REST API.
- **Offline Scope**: Full offline two-way database synchronization is out of scope for V1. The app handles transient network errors gracefully with retry feedback (per `NFR-REL-003`).

## Alternatives considered

- **Flutter / Dart**: Rejected. Using Dart would prevent sharing TypeScript contracts, validation schemas, and the generated API client with the rest of the monorepo.
- **Bare React Native (CLI)**: Rejected. Bare React Native introduces high native build maintenance and platform version synchronization issues; Expo SDK 57 provides a streamlined, modern native runtime with EAS Build support.

## Consequences

### Positive

- Seamless code sharing of API client contracts (`packages/api-client`) and Zod schemas with Web and Backend.
- Rapid development and physical device testing via Expo tooling and EAS preview builds.
- Clear acceptance boundary targeting Android 10+ construction tablets/smartphones.
- Secure token handling via hardware-backed keystores through `expo-secure-store`.

### Negative / trade-offs

- Field users requiring full offline functionality must rely on online connectivity at the job site in V1.

## Constraints

- Mobile release and defense verification is strictly Android 10+.
- Mobile never connects directly to PostgreSQL.

## Related requirements / documents

- [docs/foundation/QUALITY-ATTRIBUTES.md](../../foundation/QUALITY-ATTRIBUTES.md) (`NFR-CMP-002`, `NFR-USA-001`)
- [docs/foundation/PRODUCT-BASELINE.md](../../foundation/PRODUCT-BASELINE.md)
- [ADR-006](ADR-006-api-contract.md) — API Contract & Code Generation
- [ADR-009](ADR-009-authentication-session.md) — Authentication & Session Management
- [ADR-015](ADR-015-mobile-build.md) — Mobile Build & Distribution Strategy

## Supersedes / Superseded by

None.
