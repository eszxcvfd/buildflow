# ADR-010 — Attachment & Media Storage Architecture

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow requires storing and serving binary media files for:
- Pre-start readiness evidence and site condition photos.
- On-site blocker photographic evidence.
- Quality control inspection photo records and test reports.
- Rectification submission proof before and after corrective repair.
- Work Order reference specifications and drawings.

Storing binary files directly inside PostgreSQL (as `BYTEA` or base64) bloats database backups, impairs database memory caching, and degrades query performance. Conversely, storing files in local server filesystem directories introduces tight filesystem coupling that breaks in multi-container setups and prevents easy cloud migration.

## Decision

We adopt a **Decoupled S3-Compatible Object Storage Architecture** with **MinIO** for local/demo baselines and **PostgreSQL** for metadata tracking.

### Storage Architecture

```text
Upload Flow:
Client (Web / Mobile)
   ↓ (1. Request Upload / Send Binary to Protected Endpoint)
NestJS Backend (validates size, MIME type, project scope, owner existence)
   ↓ (2. Put Object via S3 Adapter)
S3-Compatible Object Storage (MinIO / AWS S3 / Cloudflare R2)
   ↓ (3. Record Metadata)
PostgreSQL attachments table (stores metadata, key, owner, size, mime, sha256)

Download Flow:
Client (Web / Mobile)
   ↓ (1. Request Attachment URL)
NestJS Backend (checks role + project-scope permission on owner entity)
   ↓ (2. Generate short-lived presigned URL or controlled stream)
Direct secure access to Object Storage via Presigned GET
```

### Key Rules & Invariants

1. **Port & Adapter Abstraction**: The backend defines a domain port `ObjectStoragePort` in the Notification & Insight / Platform layer, implemented by an S3-compatible client adapter. This allows swapping MinIO for AWS S3, Cloudflare R2, or Google Cloud Storage without modifying any domain or application logic.
2. **Metadata in PostgreSQL**: The `attachments` table stores:
   - `id` (UUID), `owner_type`, `owner_id` (polymorphic relation).
   - `object_key` (namespaced storage key, e.g. `projects/{projectId}/inspections/{id}/{uuid}.jpg`).
   - `file_name`, `mime_type`, `byte_size`, `checksum_sha256`.
   - `uploaded_by` (User UUID), `created_at`, `deleted_at`.
3. **Strict Non-Storage in DB**: No base64 encoded strings, no raw binary BLOBs, and no absolute local filesystem paths are stored in PostgreSQL business tables.
4. **Protected Access**: Buckets are private by default. File downloads require backend authorization and are served via short-lived presigned URLs (e.g. valid for 15 minutes) or authorized proxy streams.
5. **Retention Compliance**: Attachments follow the 5-year post-project-closure retention policy (per `CR-001/Q-15`).

## Alternatives considered

- **PostgreSQL `BYTEA` columns**: Rejected. Severely degrades database performance, bloats transaction logs (WAL), and slows down database dumps and migrations.
- **Local Server File System (`/uploads/`)**: Rejected. Breaks in containerized, multi-instance environments, lacks presigned URL capabilities, and complicates cloud migration.
- **Third-Party SaaS Storage (Cloudinary / Uploadcare)**: Rejected. Introduces unnecessary proprietary SDKs and vendor lock-in.

## Consequences

### Positive

- Clean separation between structured metadata (PostgreSQL) and unstructured binary data (MinIO/S3).
- 100% cloud-portable: works out of the box with MinIO in Docker locally/VPS, and trivially switches to AWS S3 / Cloudflare R2 in production.
- High download performance with minimal backend server memory overhead via presigned URLs.
- Secure, project-scoped access control enforced on every media request.

### Negative / trade-offs

- Requires running a MinIO service container alongside PostgreSQL in the local development and demo Docker Compose stack.

## Constraints

- Direct public access to S3 storage buckets is forbidden.
- Binary blobs must never be committed to database tables or Git repositories.

## Related requirements / documents

- [docs/foundation/DATA-BASELINE.md](../../foundation/DATA-BASELINE.md)
- [docs/foundation/SECURITY-BASELINE.md](../../foundation/SECURITY-BASELINE.md)
- [docs/foundation/REQUIREMENTS-CATALOG.md](../../foundation/REQUIREMENTS-CATALOG.md) (`RPT-SRS-008`, `QUA-SRS-009`)
- [ADR-014](ADR-014-deployment-platform.md) — Containerized Deployment Topology

## Supersedes / Superseded by

None.
