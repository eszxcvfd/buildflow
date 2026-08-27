# Work Routing

> Setup seed: this is the target repository's shared pointer. Keep it aligned
> with verified repository doctrine; the owner documents below remain the
> source of truth for their own subjects.

For repository work, open only the smallest current document set needed:

- orientation and change routing: `ARCHITECTURE.md`;
- doc ownership and routing: `docs/README.md`;
- lane selection and proof: `docs/process/DEVELOPMENT.md`;
- current work queue: `docs/issues/ROADMAP.md`;
- non-trivial plans or durable coordination: `PLANS.md`;
- runtime or protocol ownership: `docs/architecture/RUNTIME.md` and
  `docs/architecture/NETCODE.md`;
- server-relevant resource and cook/package boundaries:
  `docs/architecture/CONTENT.md`.

Use the entries that exist in the target repository. If a governing document
is silent or stale, record the bounded inference or update the canonical owner
document before relying on a new rule. Doctrine is editable repository truth.

`docs/process/DEVELOPMENT.md` owns lane selection, and `PLANS.md` owns the
conditions and contents for design notes and checked-in plans. Do not invent
another routing rule here. Do not trigger closeout for doc-only edits, small
owner-neutral fixes, or partial progress unless the governing plan requires it.

This file is a pointer, not a second routing system or an owner document.
Repository-facing skills consult it before acting, then follow the canonical
owner documents above.
