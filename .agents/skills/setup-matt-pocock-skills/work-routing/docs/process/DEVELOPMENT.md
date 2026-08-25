# Development Process

> Work Routing seed: this is the target repository's canonical owner for lane
> selection, proof, test discipline, hard cuts, and closeout.

## Lane selection and proof

This document owns lane selection and proof requirements for repository work.
Choose the lane here, state the proof expected for the current contract, and
record any bounded inference before relying on a silent or stale governing
document. Do not invent a second lane or routing system in a skill, issue, or
plan.

Open only the smallest current document set needed. Use
[`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for orientation,
[`../README.md`](../README.md) for document ownership,
[`../issues/ROADMAP.md`](../issues/ROADMAP.md) for the queue,
[`../../PLANS.md`](../../PLANS.md) for non-trivial plans, and the
canonical runtime, protocol, and content documents when the change touches
their boundaries.

## Test discipline

Tests protect a settled production contract; they do not choose architecture,
invent owners, or justify a production seam. Use test-first RED/GREEN only for
deterministic behavior whose contract and owner are already decided.

Do not add or retain production APIs, state, lifecycle branches, dependency
features, or instrumentation whose only consumer is a test or proof harness.

Delete tests whose only claim is a retired or forbidden name, source substring,
help text, file inventory, private call order, phase label, proof-registry
membership, or generated report shape unless that exact representation is a
public machine contract.

After every schema or protocol hard cut, audit every added or modified test and
fixture. Negative cases must protect current-contract invariants without naming
or hardcoding deleted fields, tags, widths, values, or other contracts; derive
invalid inputs from current constants and boundaries such as `WIDTH - 1` and
`WIDTH + 1`.

Use the diff to discover removed identifiers and values, then search current
code, tests, and fixtures for them. Never commit a legacy blacklist, tombstone
registry, or source-substring gate. A hard cut cannot close while historical
names or literals remain in current tests or fixtures.

Ask whether each test remains meaningful without Git history; delete or rewrite
one that only proves a dead contract is rejected. Also remove any production
API or state that exists only to make such behavior observable.

Prefer outcome-level tests at the owning boundary. A fixture that constructs a
parallel game/runtime model proves only the fixture and must not gate the
production implementation.

## Hard-cut rules

Apply these rules when the governing repository docs identify the product as
pre-publication. If that phase is not explicit, record the bounded inference
before applying them.

- Keep exactly one current schema, metadata, architecture, protocol, package
  identity, and compatibility-admission contract. Keep protocol/schema version
  `1` until first public shipment; replace Version 1 instead of introducing
  v2/v3.
- At schema, protocol, metadata, package-identity, and compatibility-admission
  boundaries, validate the current contract before mutation and reject input
  that does not match it. Do not interpret older data through a fallback. This
  rule does not prescribe a wider failure scope for faults after admission.
- Do not add legacy/current branches, dual read/write paths, compatibility
  facades, or migration-warning behavior.
- Update every current shipping producer, consumer, and generated artifact that
  is compiled, loaded, or otherwise consumed by the product or toolchain in the
  same contract change. Audit tests, fixtures, validators, reports, snapshots,
  mocks, and proof output independently; repository ownership alone does not
  make them synchronization peers.

## Closeout

Do not trigger closeout for doc-only edits, small owner-neutral fixes, or
partial progress unless the governing plan requires it.
