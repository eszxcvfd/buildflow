# Work Routing

This file routes work without re-creating product rules.

## Mandatory start

For every task:

1. Read [docs/foundation/README.md](docs/foundation/README.md).
2. Read only the canonical documents routed below.
3. Check [docs/foundation/OPEN-DECISIONS.md](docs/foundation/OPEN-DECISIONS.md).
4. If a blocking decision is Open, stop detailed design/implementation for that behaviour and request approval.

Legacy source code and unreconciled documents are not business or architecture evidence.

## Routing table

| Change | Owner/lane | Required documents | Minimum proof |
| --- | --- | --- | --- |
| Account, role, project authorization | Identity & Access | Product baseline, module map, security baseline, IAM requirements | authorization matrix + unit/integration/security tests |
| Worker, Trade, Crew, Crew Lead | Workforce | Context, module map, ORG requirements, data baseline | invariant + eligibility integration tests |
| Project, area, Work Type, dependency | Project Setup | Module map, PRJ requirements, states, data baseline | validation + dependency-cycle + permission tests |
| Work Order, schedule, Job Board, assignment | Work Management | Rules, states, JOB/SCH requirements, open decisions | state + concurrency + idempotency + contract tests |
| Readiness, blocker, progress, material, Work Done | Field Execution | Rules, states, JOB requirements, data baseline | Start gate + retry + audit integration tests |
| Checklist, checkpoint, inspection, rectification, close | Quality Control | Rules, states, QUA requirements, data baseline | Hold Point + immutable rounds + close-gate tests |
| Notification, dashboard, KPI, export, audit | Notification & Insight | RPT requirements, traceability, open decisions | permission-safe deep link + drill-down equality + audit tests |
| Cross-module contract or schema | Producing module coordinates | Module designs for producer and every consumer | producer and consumer updated in one change |
| Documentation only | Documentation | Documentation standards and affected canonical source | link, ID, count and consistency checks |

## Detailed-design gate

Use [docs/foundation/templates/MODULE-DESIGN-TEMPLATE.md](docs/foundation/templates/MODULE-DESIGN-TEMPLATE.md) before implementing a module. The design is ready only when [docs/foundation/DEFINITION-OF-READY-DONE.md](docs/foundation/DEFINITION-OF-READY-DONE.md) is satisfied.

## Conflict and change

Do not create a local workaround rule. Route every requirement conflict or new policy through [docs/foundation/CHANGE-CONTROL.md](docs/foundation/CHANGE-CONTROL.md).
