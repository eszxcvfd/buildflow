# ADR-001 — Monorepo & Workspace Architecture

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow consists of three client/server applications:
1. Backend REST API (`apps/api`)
2. Web Dashboard & Management Portal (`apps/web`)
3. Mobile Field App (`apps/mobile`)

Managing three separate repositories (polyrepo) creates significant overhead in a student capstone project: contract desynchronization between API and Web/Mobile, duplicated TypeScript models, difficult local multi-app orchestration, and fragmented CI pipelines. Conversely, heavy monorepo tooling like Nx introduces excessive proprietary plugins, abstraction layers, and cognitive overhead.

## Decision

We adopt a lightweight monorepo architecture using **pnpm Workspaces** orchestrated by **Turborepo**.

### Repository Structure

```text
buildflow/
├── apps/
│   ├── api/             # NestJS Backend Application
│   ├── web/             # Next.js Web Application
│   └── mobile/          # Expo / React Native Application
│
├── packages/
│   ├── api-client/      # Auto-generated TypeScript API client from OpenAPI
│   ├── contracts/       # Shared TypeScript DTO interfaces and validation schemas
│   ├── eslint-config/   # Shared ESLint configuration presets
│   └── tsconfig/        # Shared TypeScript tsconfig base presets
│
├── infra/               # Docker, Compose, Caddy configurations
├── docs/                # Foundation, architecture and ADR documentation
├── package.json         # Root workspace manifest
├── pnpm-workspace.yaml  # Workspace package definitions
└── turbo.json           # Turborepo task pipeline definitions
```

### Monorepo Principles

1. **Strict Separation of Concerns**: Web and Mobile **do not** share UI components or presentation logic. Web is built for large desktop screens (Next.js/Ark UI) while Mobile is built for field devices (Expo/React Native).
2. **Platform-Independent Sharing**: Only genuinely platform-independent assets are shared via `packages/` (typed API clients, contract types, lint/compiler configurations).
3. **Atomic Task Pipelines**: Turborepo manages parallel builds, typechecking, linting, and test caching across packages and applications.

## Alternatives considered

- **Polyrepo (3 independent repositories)**: Rejected due to contract drift, tedious cross-repo PRs, and multi-repo synchronization friction.
- **Nx Monorepo**: Rejected due to high configuration complexity, heavy generator magic, and steep learning curve for the team.
- **Lerna / Yarn Workspaces**: Rejected in favor of pnpm workspaces, which offer superior disk efficiency, strict non-flat `node_modules`, and faster execution.

## Consequences

### Positive

- Single pull request covers full-stack changes (e.g., API endpoint update + generated client update + Web/Mobile consumer update).
- Eliminates manual TypeScript interface duplication between Backend and Frontend.
- Fast, cached CI and local builds powered by Turborepo pipeline caching.
- Enforces consistent code style, linting, and compiler settings across the entire codebase.

### Negative / trade-offs

- Repository size is larger than a single app repo.
- Developers must use `pnpm` workspace syntax (e.g., `pnpm --filter api ...`).

## Constraints

- `pnpm` is the mandatory package manager; npm and yarn are strictly prohibited.
- UI code sharing between Web and Mobile is forbidden.

## Related requirements / documents

- [ADR-002](ADR-002-node-typescript-runtime.md) — Language and Runtime Baseline
- [ADR-006](ADR-006-api-contract.md) — API Contract & Code Generation
- [docs/foundation/MODULE-MAP.md](../../foundation/MODULE-MAP.md)

## Supersedes / Superseded by

None.
