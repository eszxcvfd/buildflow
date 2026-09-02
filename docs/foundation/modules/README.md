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

The foundation completion gate has passed through CR-001 and accepted
ADR-001..015. The following approved designs authorize the 34-table database
baseline only; API, UI and application-service details remain just-in-time
work.

| Module | Design |
| --- | --- |
| Identity & Access | [identity-access/design.md](identity-access/design.md) |
| Workforce | [workforce/design.md](workforce/design.md) |
| Project Setup | [project-setup/design.md](project-setup/design.md) |
| Work Management | [work-management/design.md](work-management/design.md) |
| Field Execution | [field-execution/design.md](field-execution/design.md) |
| Quality Control | [quality-control/design.md](quality-control/design.md) |
| Notification & Insight | [notification-insight/design.md](notification-insight/design.md) |
