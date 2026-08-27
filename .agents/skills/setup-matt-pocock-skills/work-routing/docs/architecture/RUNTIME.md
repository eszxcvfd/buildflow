# Runtime Architecture

> Work Routing seed: this is the target repository's canonical owner for
> runtime lifecycle and ownership boundaries; keep project facts verified.

## Ownership

This document is the canonical owner for runtime lifecycle, ownership,
state-flow, execution-boundary, and runtime proof claims. Keep verified
runtime facts here; keep protocol details in
[`NETCODE.md`](NETCODE.md) and server resource or cook/package details in
[`CONTENT.md`](CONTENT.md).

## Current contract

<!-- Record verified entry points, lifecycle states, owners, invariants, and
     evidence here. This setup seed intentionally invents none of them. -->

## Change boundary

When a change crosses a runtime ownership boundary, read the smallest relevant
set of current documents, select the lane and proof in
[`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md), and update this
canonical owner before relying on a new rule. Do not preserve a runtime API,
state, lifecycle branch, dependency, or instrumentation only to support a test
or compatibility fallback.

## Evidence and open questions

Record the source of non-obvious claims, bounded inferences, and unresolved
ownership questions here. Do not use this document as a second queue or plan.
