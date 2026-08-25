# Content Architecture

> Work Routing seed: this is the target repository's canonical owner for
> server resources and cook/package boundaries; keep project facts verified.

## Ownership

This document is the canonical owner for server-relevant resources, asset
identity, cook boundaries, package boundaries, loading inputs, and generated
content artifacts. Keep runtime lifecycle claims in [`RUNTIME.md`](RUNTIME.md)
and wire or protocol claims in [`NETCODE.md`](NETCODE.md).

## Current contract

<!-- Record verified resource owners, cook/package inputs and outputs, package
     identity, deployment boundaries, and evidence here. This setup seed
     intentionally invents none of them. -->

## Change boundary

When resource, cook, or package identity changes, identify every current
shipping producer, consumer, and generated artifact that is compiled, loaded,
or otherwise consumed by the product or toolchain. Validate the current
contract before mutation; do not add a legacy/current package path or
compatibility fallback without an explicit current doctrine decision.

Select the lane and proof in [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md)
and record non-trivial coordination in [`../../PLANS.md`](../../PLANS.md).

## Evidence and open questions

Record the source of non-obvious content claims, bounded inferences, and
unresolved ownership questions here. Do not use this document as a second
roadmap or plan.
