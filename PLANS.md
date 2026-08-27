# Plans

> Work Routing seed: this is the target repository's canonical owner for plan
> conditions and contents; keep project facts and decisions verified.

## Ownership

This document owns the conditions and contents for design notes, non-trivial
plans, and durable coordination in this repository.

## When a plan is required

Create or update a checked-in plan when the work is non-trivial, crosses
ownership boundaries, changes a runtime or protocol contract, changes server
resource or cook/package boundaries, or needs durable coordination. For
doc-only edits, small owner-neutral fixes, and partial progress, do not create
or trigger plan closeout unless an existing governing plan requires it.

If the repository's governing documents are silent or stale, record the bounded
inference or update the canonical owner before relying on a new plan rule.

## Required contents

A checked-in plan should state, as applicable:

- the objective, scope, and non-goals;
- the current contract and canonical owner for each affected boundary;
- the selected lane and proof required by
  [`docs/process/DEVELOPMENT.md`](docs/process/DEVELOPMENT.md);
- dependencies, risks, decisions, and bounded inferences;
- the files, producers, consumers, generated artifacts, tests, fixtures, and
  validators that must stay synchronized;
- completion evidence and any remaining follow-up.

## Current plans


## DBD V2.1 PostgreSQL initialization

- **Objective:** create and verify the first forward-only PostgreSQL migration from `DBD.md` V2.1.
- **Scope:** `src/api` migration runner and SQL schema; local PostgreSQL proof through the existing Compose data boundary; update data/routing status where scaffold facts change.
- **Non-goals:** no domain/API feature implementation, no Web/Mobile database access, no Redis domain state, no production topology/backup decision, no destructive reset of an existing developer volume.
- **Owners:** `src/api` owns migration/schema execution; `infra/docker` owns PostgreSQL/Redis process, network, volume and healthcheck; `DBD.md` owns the physical schema baseline.
- **Lane:** `data`, coordinated by `src/api` + `infra` as required by `WORK-ROUTING.md`.
- **Required proof:** `docker compose config`, PostgreSQL/Redis health, forward migration on an isolated database, schema verification for 34 baseline tables and primary constraints/indexes, and Redis PING/config proof. Existing local volumes remain untouched.
- **Evidence/status:** Redis is running and verified with `PONG`, empty keyspace, `appendonly=no` and `maxmemory-policy=noeviction`. A separate `buildflow_dbd` database was created and migrated successfully; it contains 34 DBD baseline tables plus `schema_migrations`, and the runner was verified as apply-then-skip. The existing legacy `buildflow` database remains untouched. A full re-audit against `DBD.md` section 5 confirmed 34/34 tables, 0 column type/nullability/default errors, and 87/87 suggested indexes present (plus 4 DBD-mandated extras: `ux_users_phone`, `ux_users_employee_code`, `ux_attachments_storage_key`, `ux_inspection_checkpoints_work_sequence`). The missing `corrective_actions_assignee_xor_ck` check was added to the baseline migration, verified by a violating-insert rejection proof.
