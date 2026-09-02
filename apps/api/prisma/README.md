# Prisma

[`apps/api/prisma/schema.prisma`](schema.prisma) maps the DBD V2.1 physical
baseline: **26 business tables and 8 system-support tables** on PostgreSQL 18
([ADR-007]) through Prisma 7.x ([ADR-008]). Prisma's `_prisma_migrations` table
is technical migration history and is not included in the 34-table count.

```text
apps/api/prisma/
├── schema.prisma
└── migrations/
    ├── migration_lock.toml
    └── 20260902000000_dbd_v2_1_baseline/
        ├── migration.sql
        └── README.md
```

The migration SQL is authoritative for PostgreSQL `CHECK` constraints,
expression indexes and partial unique indexes that Prisma schema syntax does
not fully represent. Do not remove those constraints after introspection.
Prisma introspection may also infer a one-to-one relation from a partial unique
index; preserve the one-to-many history cardinality for `Work Order →
Assignments` and `Crew → Crew Members` when reviewing any future `db pull`.

Workflow:

```sh
# Edit schema.prisma
pnpm --filter @buildflow/api prisma:migrate:dev -- --name <change> --create-only
# Review generated SQL, then apply it locally
pnpm --filter @buildflow/api prisma:migrate:dev
# Apply in production-like env
pnpm --filter @buildflow/api prisma:migrate:deploy
# Regenerate the typed client after schema changes
pnpm --filter @buildflow/api prisma:generate
```

Never edit an already-applied migration. Create a new forward-only migration
and include data backfill plus recovery notes when an existing populated table
changes.

[ADR-007]: ../../../docs/architecture/adr/ADR-007-postgresql-database.md
[ADR-008]: ../../../docs/architecture/adr/ADR-008-prisma-migrations.md
