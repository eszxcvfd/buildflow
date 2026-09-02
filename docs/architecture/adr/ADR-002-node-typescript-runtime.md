# ADR-002 — Language and Runtime Baseline

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

A modern multi-application project spanning Backend, Web, and Mobile requires a stable, uniform execution runtime and type system. Inconsistent Node.js versions between developer workstations, CI runners, and production containers frequently cause subtle runtime bugs, package manager incompatibilities, and build failures.

## Decision

We standardize the entire BuildFlow repository on:

1. **Runtime**: **Node.js 24 LTS** across all local environments, CI runners, and Docker containers.
2. **Runtime Locking**: A root `.node-version` file locks the exact Node.js version (and `.nvmrc` is maintained identically for compatibility).
3. **Language**: **TypeScript** across all applications and shared packages, configured with `"strict": true` in `packages/tsconfig/base.json`.
4. **Package Manager**: **pnpm** (pinned via package.json `packageManager` field) as the sole package manager.

## Alternatives considered

- **Node.js 20 / 22 LTS**: Rejected in favor of Node.js 24 LTS to leverage modern built-in capabilities, enhanced V8 performance, native module support, and long-term support runway for the project lifespan.
- **npm / yarn**: Rejected due to npm's flat and phantom dependency issues, yarn's slower monorepo resolution, and lack of strict isolated dependency graphs.

## Consequences

### Positive

- Complete deterministic parity between local development, CI checks, and containerized deployment.
- High developer productivity with unified TypeScript typing across API, Web, Mobile, and shared packages.
- Strict mode eliminates runtime `null`/`undefined` type errors early during build/typecheck.
- Fast dependency installation and minimal disk consumption through pnpm's content-addressable storage.

### Negative / trade-offs

- Developers must have Node.js 24 LTS and pnpm installed locally (managed easily via nvm / fnm / corepack).

## Constraints

- TypeScript `"strict": true` is non-negotiable across all packages.
- Committing `package-lock.json` or `yarn.lock` is forbidden; only `pnpm-lock.yaml` is tracked.

## Related requirements / documents

- [ADR-001](ADR-001-monorepo-workspace.md) — Monorepo & Workspace Architecture
- [ADR-013](ADR-013-ci-platform.md) — Continuous Integration Pipeline

## Supersedes / Superseded by

None.
