# Documentation Standards

## Single source of truth

- Product facts live in this foundation and its registered source snapshots.
- Root `CONTEXT.md` owns domain vocabulary only.
- Open choices live only in `OPEN-DECISIONS.md` until approved.
- Hard-to-reverse accepted technical choices may receive a concise ADR in `docs/architecture/adr/`.
- Module details live in one module design created just in time.

## Required metadata

Every new design/spec states: status, owner, source requirement IDs, open-decision dependencies, last reviewed date and superseded document if any.

Allowed status: Draft, In Review, Approved, Superseded.

## Writing rules

- Use stable IDs and exact domain terms from `CONTEXT.md`.
- Separate fact, approved decision, recommendation and TBD.
- Link to the authority instead of copying the same rule into multiple places.
- State observable behaviour and invariants before API, schema or UI details.
- Define owner and consumer for every cross-module contract.
- Include failure, authorization, retry, concurrency and audit behaviour where relevant.
- Never use implementation code as evidence that a requirement is correct.

## Review cadence

- Before module design: refresh source versions and open decisions.
- Before implementation: approve the module design and Definition of Ready.
- Before merge: update traceability and evidence.
- After an approved change: update all affected documents in the same pull request.

## Artifact placement

To keep the repository free of orphan directories, every written artifact must use the canonical location below. Do not invent new top-level folders (`docs/plans/`, `docs/notes/`, `docs/tmp/`, `planning/`, `notes/`) without demonstrated need and explicit change control approval.

| Artifact | Canonical location |
| --- | --- |
| Product / business baseline, source-of-truth requirements, state machines, business rules, module map | `docs/foundation/` |
| Change records, policy reconciliations | `docs/foundation/changes/` |
| Domain vocabulary, glossary of approved terms | `CONTEXT.md` (repo root) |
| Architecture decisions (ADRs) | `docs/architecture/adr/` |
| Feature specs and implementation tickets | GitHub Issues |
| Just-in-time module designs | `docs/foundation/modules/<module>/` (see `docs/foundation/modules/README.md`) |
| Large multi-session decision planning / wayfinder maps | GitHub Issues |
| Temporary reports, session handoffs, research notes, throwaway prototypes | OS temporary directory (e.g. `%TEMP%/opencode/`), unless the relevant skill explicitly says otherwise |
| Tooling-derived docs (e.g. generated API client references) | `packages/api-client/README.md` or `apps/<app>/README.md` |

When two locations seem plausible, follow the rule in `WORK-ROUTING.md`. The repository documentation policy is the source of truth.

## Agent loading

Agents must begin at `docs/foundation/README.md`, then load only the documents routed by the current task. They must not recursively ingest old repository documentation as business truth.
