# Network and Protocol Architecture

> Work Routing seed: this is the target repository's canonical owner for
> protocol and compatibility-admission boundaries; keep project facts verified.

## Ownership

This document is the canonical owner for network, wire-format, schema,
serialization, protocol-version, and compatibility-admission claims. Keep
runtime lifecycle ownership in [`RUNTIME.md`](RUNTIME.md) and server resource
or cook/package ownership in [`CONTENT.md`](CONTENT.md).

## Current contract

<!-- Record the one verified current protocol/schema contract, its bounds,
     producers, consumers, generated artifacts, and admission evidence here.
     This setup seed intentionally invents none of them. -->

## Compatibility admission

When governing repository docs identify the product as pre-publication,
breaking changes are mandatory and legacy versions are not supported. Keep one
current protocol/schema contract, validate it before mutation, and reject
mismatches. Do not add legacy/current branches, dual read/write paths,
compatibility facades, migration warnings, or fallback interpretation of older
data. If the phase is not explicit, record the bounded inference before
applying this rule.

Update every current shipping producer, consumer, and generated artifact in
the same contract change. Audit tests, fixtures, validators, reports,
snapshots, mocks, and proof output independently; they are not automatically
protocol synchronization peers.

## Evidence and open questions

Record the source of non-obvious protocol claims, bounded inferences, and
unresolved ownership questions here. Use
[`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md) for lane selection,
test discipline, proof, and closeout rules.
