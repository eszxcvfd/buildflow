# Roadmap

> Work Routing seed: this is the target repository's canonical owner for the
> current work queue; keep queue entries verified.

## Current work queue

This document is the canonical current work queue. Keep active work, ordering,
dependencies, and explicit blockers here or in the issue tracker named by the
repository's setup configuration. Do not infer priority from an unrelated
document.

1. **Slice 1 — Worker tự nhận Work Order** (spec: [#1](https://github.com/eszxcvfd/buildflow/issues/1), label `ready-for-agent`) — login, Job Board, self-claim với single-winner, My Jobs. Plan conditions tại [`PLANS.md`](../../PLANS.md). Trạng thái: spec đã publish, chưa có ticket breakdown.

## Routing

Use [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md) for lane selection
and proof. Use [`../../PLANS.md`](../../PLANS.md) when work needs a non-trivial
plan or durable coordination. If a queue rule is missing, record the bounded
inference or update this canonical owner before relying on it.
