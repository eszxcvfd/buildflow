# Prisma

[`apps/api/prisma/schema.prisma`](../../../../apps/api/prisma/schema.prisma) is intentionally empty: it holds only the `datasource` and `generator` blocks for **PostgreSQL 18** ([ADR-007]) and **Prisma 7.x** ([ADR-008]). Business entities land per-module, just in time.

```text
apps/api/prisma/
├── schema.prisma
└── migrations/
    └── migration_lock.toml
```

Workflow:

```sh
# Edit schema.prisma
pnpm --filter @buildflow/api prisma:migrate:dev -- --name <change>
# Apply in production-like env
pnpm --filter @buildflow/api prisma:migrate:deploy
# Regenerate the typed client after schema changes
pnpm --filter @buildflow/api prisma:generate
```

[ADR-007]: ../../../docs/architecture/adr/ADR-007-postgresql-database.md
[ADR-008]: ../../../docs/architecture/adr/ADR-008-prisma-migrations.md
