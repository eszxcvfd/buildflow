# Module designs

Just-in-time module design documents live in this directory.

## Convention

Each business module gets its own subdirectory:

```text
docs/foundation/modules/<module-name>/
├── README.md            # status, owner, source requirement IDs, supersedes
└── design.md            # template content (see below)
```

`<module-name>` uses the kebab-case identifier from [`docs/foundation/MODULE-MAP.md`](../MODULE-MAP.md).

## Status values

`Draft` · `In Review` · `Approved` · `Superseded`

`Approved` designs only become implementation authority when the [`DEFINITION-OF-READY-DONE.md`](../DEFINITION-OF-READY-DONE.md) gate passes.

## Template

Use [`../templates/MODULE-DESIGN-TEMPLATE.md`](../templates/MODULE-DESIGN-TEMPLATE.md). Do not invent alternative structures.

## Scope

This directory currently contains only the convention. Detailed module designs are **out of scope** until Phase 1 just-in-time analysis begins. Do not create designs for `Identity & Access`, `Workforce`, `Project Setup`, `Work Management`, `Field Execution`, `Quality Control`, or `Notification & Insight` until the repository foundation has passed its completion gate.
