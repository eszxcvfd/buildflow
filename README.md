# BuildFlow

Monorepo for the BuildFlow platform: construction work management and on-site
quality control for VINACON.

This repository hosts the **technical foundation only**. Business modules
(`Identity & Access`, `Workforce`, `Project Setup`, `Work Management`,
`Field Execution`, `Quality Control`, `Notification & Insight`) land in
subsequent phases — see [`docs/foundation/modules/`](docs/foundation/modules/README.md).

## Architecture decisions

Authoritative record: [`docs/architecture/adr/`](docs/architecture/adr/README.md)
(`ADR-001` … `ADR-015`).

| Decision | ADR |
| --- | --- |
| Monorepo + pnpm workspaces + Turborepo | ADR-001 |
| Node.js 24 LTS, TypeScript strict, pnpm only | ADR-002 |
| NestJS REST API, modular monolith | ADR-003 |
| Next.js 16 web | ADR-004 |
| Expo SDK 57 mobile (Android 10+) | ADR-005 |
| REST + OpenAPI + generated TypeScript client | ADR-006 |
| PostgreSQL 18 single shared database | ADR-007 |
| Prisma ORM 7 + Prisma Migrate | ADR-008 |
| NestJS-owned JWT auth (lands later) | ADR-009 |
| S3-compatible attachments via MinIO | ADR-010 |
| Redis deferred from V1 | ADR-011 |
| Jest + Supertest + real PostgreSQL integration | ADR-012 |
| GitHub Actions CI | ADR-013 |
| Caddy + Docker Compose deployment | ADR-014 |
| EAS Build for mobile | ADR-015 |

## Repository layout

```text
apps/
├── api/          NestJS REST API (technical shell)
├── web/          Next.js 16 web app
└── mobile/       Expo Router mobile app

packages/
├── api-client/   Generated TypeScript client (output of `openapi-typescript`)
├── contracts/    Cross-client technical types
├── eslint-config/  Shared ESLint presets
└── tsconfig/     Shared TSConfig presets

infra/            Optional local Docker Compose (PostgreSQL 18 + MinIO)
docs/             Foundation + architecture + ADRs
```

## Local workflow

Shared requirements: **Node.js 24 LTS** (see `.node-version`), **pnpm 11+**,
and a reachable **PostgreSQL 18.x** instance. PostgreSQL may be installed
directly on the developer machine or run with Docker. Docker is required only
when a developer chooses the containerized PostgreSQL/MinIO workflow.

Install dependencies and create each runtime environment file:

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

For Expo Go on a physical device, replace `EXPO_PUBLIC_API_URL` in
`apps/mobile/.env.local` with this computer's LAN IPv4. Both devices must use
the same network. Application `.env` files are local and ignored by Git; when
the environment contract changes, update the adjacent `.env.example`.

Set `DATABASE_URL` in `apps/api/.env` for the selected database:

- **Native PostgreSQL:** start the local PostgreSQL 18.x service, create the
  database/user, and use its host, port, database, and credentials.
- **Docker PostgreSQL:** copy `infra/.env.example` to `infra/.env`, then run:

  ```sh
  docker compose --env-file infra/.env -f infra/compose.yaml up -d postgres
  ```

The default Docker settings match the example API connection string. Apply
existing migrations and generate Prisma Client:

```sh
pnpm --filter @buildflow/api prisma:migrate:deploy
pnpm --filter @buildflow/api prisma:generate
```

Run the applications in separate terminals:

```sh
pnpm --filter @buildflow/api start:dev
pnpm --filter @buildflow/web dev
pnpm --filter @buildflow/mobile dev
```

MinIO is independent of the PostgreSQL choice and can be started when
attachment work needs it:

```sh
docker compose --env-file infra/.env -f infra/compose.yaml up -d minio
```

See [`infra/README.md`](infra/README.md) for port-conflict guidance and the
complete container workflow.

| Task | Command |
| --- | --- |
| Lint everything | `pnpm lint` |
| TypeScript across the workspace | `pnpm typecheck` |
| Unit tests | `pnpm test` |
| Production builds | `pnpm build` |
| API integration tests (real PostgreSQL) | `pnpm test:integration` |
| Regenerate the API client from OpenAPI | `pnpm generate` |
| Format with Prettier | `pnpm format` |

See per-app READMEs:

- [`apps/api`](apps/api/README.md)
- [`apps/web`](apps/web/README.md)
- [`apps/mobile`](apps/mobile/README.md)
- [`packages/api-client`](packages/api-client/README.md)

## License

Private — internal BuildFlow repository.
