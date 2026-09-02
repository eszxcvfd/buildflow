# BuildFlow Documentation Foundation

This directory is the canonical documentation entry point for BuildFlow.

## Current baseline

- Product: construction work management and on-site quality control for VINACON.
- Channels: Web for administration, coordination, management and QC; Mobile for field workers, crew leads and QC.
- Business baseline: BRD-CWM-QC-002 V2.0, 54 business requirements (44 Must, 10 Should).
- Software baseline: SRS-CWM-QC-002 V2.1, 82 functional requirements (70 Must, 12 Should).
- Data baseline: DBD-CWM-QC-002 V2.1, proposed 34-table physical schema (26 business tables, 8 support tables).
- Change records: [CR-001](changes/CR-001-business-policy-decisions.md) formally approved and reconciled business policy decisions `Q-01` through `Q-15`.
- Status: Historical provenance drafts are normalized into this foundation; approved change records are the authoritative baseline for all resolved decisions.

## Authority by topic

| Topic | Primary authority | Secondary check | Rule |
| --- | --- | --- | --- |
| Business goals, scope, actors, priorities | BRD V2.0 / Approved CRs | SRS V2.1 | SRS may detail but must not expand the committed scope silently. |
| Observable software behaviour and acceptance | SRS V2.1 / Approved CRs | BRD V2.0 | A conflict is recorded as an open decision; do not choose by convenience. |
| Physical data model | DBD V2.1 / Approved CRs | SRS V2.1 then BRD V2.0 | DBD may implement a requirement, but cannot invent a business rule. |
| New approved requirement | Approved change record | BRD/SRS/DBD | Update every affected canonical document and trace link together. |
| Implementation details | Module design created just in time | All above | Code and old architecture documents never override the product baseline. |

## Reading order

1. [SOURCE-REGISTER.md](SOURCE-REGISTER.md)
2. [PRODUCT-BASELINE.md](PRODUCT-BASELINE.md)
3. [../../CONTEXT.md](../../CONTEXT.md)
4. [MODULE-MAP.md](MODULE-MAP.md)
5. [WORKFLOWS-AND-STATES.md](WORKFLOWS-AND-STATES.md)
6. [BUSINESS-RULES.md](BUSINESS-RULES.md)
7. [REQUIREMENTS-CATALOG.md](REQUIREMENTS-CATALOG.md)
8. [DATA-BASELINE.md](DATA-BASELINE.md)
9. [QUALITY-ATTRIBUTES.md](QUALITY-ATTRIBUTES.md)
10. [OPEN-DECISIONS.md](OPEN-DECISIONS.md)
11. [TRACEABILITY.md](TRACEABILITY.md)

For system boundaries, delivery and governance, read [SYSTEM-CONTEXT.md](SYSTEM-CONTEXT.md), [SECURITY-BASELINE.md](SECURITY-BASELINE.md), [TEST-STRATEGY.md](TEST-STRATEGY.md), [DEFINITION-OF-READY-DONE.md](DEFINITION-OF-READY-DONE.md), [DELIVERY-ROADMAP.md](DELIVERY-ROADMAP.md), [CHANGE-CONTROL.md](CHANGE-CONTROL.md), [GIT-WORKFLOW.md](GIT-WORKFLOW.md), and [DOCUMENTATION-STANDARDS.md](DOCUMENTATION-STANDARDS.md).

## Agent rules

- Never infer an answer for an item in `OPEN-DECISIONS.md`.
- Never turn a Should or TBD into Must without an approved change.
- Treat material management only as Work Order planning/readiness/supplement; inventory and procurement remain out of scope.
- Keep Work Order execution, readiness, blocker and quality lifecycles separate.
- Before implementing a module, create or complete its just-in-time design using [templates/MODULE-DESIGN-TEMPLATE.md](templates/MODULE-DESIGN-TEMPLATE.md).
- Record unknown facts as `OQ-###` or `TBD`; do not write plausible defaults as facts.
- Any requirement change must follow [CHANGE-CONTROL.md](CHANGE-CONTROL.md).

## Legacy warning

Files outside `docs/foundation/` and the root `CONTEXT.md` may belong to the old scaffold. They are not product or architecture authority until explicitly reconciled and marked current.
