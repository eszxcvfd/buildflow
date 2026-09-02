# infra

Optional containerized infrastructure for BuildFlow local development.

- **PostgreSQL 18** — single shared database for all modules (`ADR-007`).
- **MinIO** — S3-compatible object storage for future attachments (`ADR-010`).
- **No Redis** in V1 (`ADR-011`).

Application code (API, Web, Mobile) runs natively during development. Team
members may run PostgreSQL 18.x either directly on their machine or through
this Compose file. The API is independent of that choice and connects through
`DATABASE_URL` in `apps/api/.env`.

## PostgreSQL options

### Native PostgreSQL

Install and start PostgreSQL 18.x locally, create the database and user, then
set `DATABASE_URL` in `apps/api/.env` using the native host, port, database,
and credentials. Do not start the Compose `postgres` service.

MinIO can still run independently when required:

```sh
cp infra/.env.example infra/.env
docker compose --env-file infra/.env -f infra/compose.yaml up -d minio
```

### Docker PostgreSQL

Copy the example environment file and start PostgreSQL. Start `minio`
separately only when object storage is needed:

```sh
cp infra/.env.example infra/.env
docker compose --env-file infra/.env -f infra/compose.yaml up -d postgres
docker compose --env-file infra/.env -f infra/compose.yaml up -d minio
```

The PostgreSQL 18 data volume defaults to `buildflow_pgdata_v18`. The
versioned name prevents an older PostgreSQL major-version volume from being
mounted into PostgreSQL 18 accidentally.

The default container publishes PostgreSQL on `127.0.0.1:5432`. If native
PostgreSQL already uses port `5432`, either stop the native service or set a
different host port such as `POSTGRES_PORT=5433` in `infra/.env`, then use the
same port in `apps/api/.env`:

```env
DATABASE_URL=postgresql://buildflow:buildflow@localhost:5433/buildflow
```

## Container lifecycle

Stop Compose services while preserving volumes:

```sh
docker compose --env-file infra/.env -f infra/compose.yaml down
```

Stop Compose services and delete their volumes:

```sh
docker compose --env-file infra/.env -f infra/compose.yaml down -v
```
