# Architecture

> Work Routing seed: replace the placeholders with verified repository truth before
> relying on this document.

## Orientation

- System or product scope: _record the verified scope._
- Primary entry points: _record the verified entry points._
- Major boundaries: _record the verified ownership boundaries._
- Current shipping phase: _record the governing repository evidence._

## Change routing

For repository work, open only the smallest current document set needed:

- orientation and change routing: this document;
- doc ownership and routing: [`docs/README.md`](docs/README.md);
- lane selection and proof: [`docs/process/DEVELOPMENT.md`](docs/process/DEVELOPMENT.md);
- current work queue: [`docs/issues/ROADMAP.md`](docs/issues/ROADMAP.md);
- non-trivial plans or durable coordination: [`PLANS.md`](PLANS.md);
- runtime or protocol ownership: [`docs/architecture/RUNTIME.md`](docs/architecture/RUNTIME.md)
  and [`docs/architecture/NETCODE.md`](docs/architecture/NETCODE.md);
- server-relevant resource and cook/package boundaries:
  [`docs/architecture/CONTENT.md`](docs/architecture/CONTENT.md).

Use the entries that exist in this repository. If a governing document is
silent or stale, record the bounded inference or update the canonical owner
document before relying on a new rule. Doctrine is editable repository truth.

`docs/process/DEVELOPMENT.md` owns lane selection, and `PLANS.md` owns the
conditions and contents for design notes and checked-in plans. Do not invent
another routing rule. Do not trigger closeout for doc-only edits, small
owner-neutral fixes, or partial progress unless the governing plan requires it.

## Evidence and maintenance

Record the source, decision, or bounded inference that establishes each
non-obvious architectural claim. Update this document when orientation or
change ownership changes; put runtime, protocol, and content details in their
canonical owner documents instead of duplicating them here.
