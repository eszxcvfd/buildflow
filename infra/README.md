# infra

Local development infrastructure for BuildFlow.

- **PostgreSQL 18** — single shared database for all modules (`ADR-007`).
- **MinIO** — S3-compatible object storage for future attachments (`ADR-010`).
- **No Redis** in V1 (`ADR-011`).

Application code (API, Web, Mobile) runs natively during development.

Bring services up:

```sh
docker compose -f infra/compose.yaml up -d
```

Tear down (preserve volumes):

```sh
docker compose -f infra/compose.yaml down
```

Tear down (delete volumes):

```sh
docker compose -f infra/compose.yaml down -v
```
