# Domain configuration

This repository is a **single-context** monorepo: one root glossary for every application and package. Domain vocabulary is centralized in [`CONTEXT.md`](../../CONTEXT.md); architectural decisions live in [`docs/architecture/adr/`](../../docs/architecture/adr/README.md).

| Field | Value |
| --- | --- |
| Context layout | single-context |
| Domain glossary | `CONTEXT.md` (repo root) |
| Canonical ADRs | `docs/architecture/adr/` |
| Per-context ADRs (`src/<context>/docs/adr/`) | **not used** |
| Per-app domain docs | **not used** |

Rules:

- Do not create additional `CONTEXT.md` files under `apps/*` or `packages/*`. Domain terms are global.
- Do not create ADRs in `docs/adr/`; that path is no longer a creation target. The repository accepts a hard-to-reverse technical choice only as a new file under `docs/architecture/adr/`, using the format already in use by ADR-001..ADR-015.
- When an installed skill (such as those from `mattpocock/skills`) ships templates that default to `docs/adr/`, override the path with the canonical BuildFlow path above rather than re-running the upstream setup.
