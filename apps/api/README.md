# @buildflow/api

BuildFlow NestJS REST API (technical foundation only).

This shell has:

- Global `/api/v1` prefix (`[ADR-006]`).
- `ConfigurationModule` with zod-validated environment loading.
- Swagger UI at `/_docs` in development.
- Health endpoint at `GET /api/v1/health` for liveness.

No business modules live here yet. They land per the
[Phase 1 module-design plan](../../../docs/foundation/modules/README.md).

## Scripts

```sh
pnpm --filter @buildflow/api dev          # local dev server on :3000
pnpm --filter @buildflow/api build        # production build → dist/
pnpm --filter @buildflow/api test         # unit tests (Jest)
pnpm --filter @buildflow/api test:integration  # real PostgreSQL integration tests
pnpm --filter @buildflow/api prisma:generate    # regenerate Prisma Client
pnpm --filter @buildflow/api prisma:migrate:dev # author a migration
pnpm --filter @buildflow/api openapi:export      # write openapi.json to disk
```

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` and adjust. `DATABASE_URL`
must point at the local Postgres container (see [`infra/`](../../../infra/README.md)).

[ADR-006]: ../../../docs/architecture/adr/ADR-006-api-contract.md
