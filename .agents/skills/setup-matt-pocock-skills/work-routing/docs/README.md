# Documentation

> Work Routing seed: this is the target repository's canonical owner for
> documentation ownership and routing.

## Ownership and routing

This index is the canonical owner for documentation ownership and routing.
Keep project-specific claims in the document that owns them.

| Area | Canonical owner |
| --- | --- |
| Orientation and change routing | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Lane selection and proof | [`process/DEVELOPMENT.md`](process/DEVELOPMENT.md) |
| Current work queue | [`issues/ROADMAP.md`](issues/ROADMAP.md) |
| Non-trivial plans and durable coordination | [`../PLANS.md`](../PLANS.md) |
| Runtime lifecycle and ownership | [`architecture/RUNTIME.md`](architecture/RUNTIME.md) |
| Protocol and compatibility admission | [`architecture/NETCODE.md`](architecture/NETCODE.md) |
| Server resources and cook/package boundaries | [`architecture/CONTENT.md`](architecture/CONTENT.md) |

## Reading rule

Open only the smallest current document set needed for the work. Use the
canonical owner above rather than creating a competing routing note. When a
governing document is silent or stale, record the bounded inference or update
the canonical owner before relying on a new rule. Doctrine is editable
repository truth.

`process/DEVELOPMENT.md` owns lane selection. `../PLANS.md` owns the conditions
and contents for design notes and checked-in plans. Do not trigger closeout for
doc-only edits, small owner-neutral fixes, or partial progress unless the
governing plan requires it.
