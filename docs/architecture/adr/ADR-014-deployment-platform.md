# ADR-014 — Containerized Deployment Topology

Status: Accepted

Date: 2026-09-02
Decision owners: Project Owner / BuildFlow Team

## Context

BuildFlow must be deployed to a reliable, cost-effective staging and demonstration environment (e.g. a Linux VPS) for defense, stakeholder review, and end-to-end multi-user testing across Web and Mobile. We need a clean, reproducible, containerized deployment topology that avoids unnecessary cloud complexity while providing automated HTTPS, security isolation, and ease of management.

## Decision

We adopt a **Single-Node Containerized Deployment Topology** orchestrated with **Docker Compose** and fronted by **Caddy Reverse Proxy**.

### Production / Demo Topology

```text
                                Internet
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     Caddy Reverse Proxy      │
                    │  (Port 80/443 - Auto HTTPS)  │
                    └──────────────┬───────────────┘
                                   │
                 ┌─────────────────┴─────────────────┐
                 │                                   │
                 ▼                                   ▼
      ┌─────────────────────┐             ┌─────────────────────┐
      │     Next.js Web     │             │     NestJS API      │
      │   (Container :3000) │             │  (Container :3001)  │
      └─────────────────────┘             └──────────┬──────────┘
                                                     │
                                   ┌─────────────────┴─────────────────┐
                                   │                                   │
                                   ▼                                   ▼
                        ┌─────────────────────┐             ┌─────────────────────┐
                        │    PostgreSQL 18    │             │      MinIO S3       │
                        │  (Container :5432)  │             │  (Container :9000)  │
                        └─────────────────────┘             └─────────────────────┘
```

### Component Roles

1. **Caddy**:
   - Acts as edge reverse proxy and API gateway.
   - Automatically provisions and renews SSL/TLS certificates via Let's Encrypt / ZeroSSL.
   - Routes `/api/*` requests to the NestJS API container and all other requests to the Next.js Web container.
   - Using same-origin or simplified subdomains eliminates complex Cross-Origin Resource Sharing (CORS) issues for Web cookies and authentication.
2. **Next.js Web**:
   - Containerized Node.js production standalone server serving Web SSR pages and static assets.
3. **NestJS API**:
   - Containerized Node.js production server running the Modular Monolith backend.
4. **PostgreSQL 18**:
   - Containerized relational database attached to a persistent Docker named volume.
   - Isolated within the internal Docker bridge network (ports not exposed directly to the public internet).
5. **MinIO Object Storage**:
   - S3-compatible object storage for media attachments attached to a persistent Docker named volume.

## Alternatives considered

- **Kubernetes (k8s / k3s)**: Rejected. Excessive infrastructure overhead, complex YAML manifests, high memory consumption, and unnecessary operational burden for a single-company student capstone system.
- **Multi-Cloud Serverless (Vercel + AWS Lambda + Supabase + Cloudflare)**: Rejected. Fractured deployment across multiple vendors increases configuration friction, vendor billing risks, and network latency.
- **Nginx**: Considered, but Caddy was chosen due to its native, automatic, zero-configuration HTTPS provisioning and simple, human-readable Caddyfile syntax.

## Consequences

### Positive

- Entire system can be launched locally or on any cloud Linux VPS with a single command: `docker compose up -d`.
- Out-of-the-box automated HTTPS and secure SSL termination.
- Zero external SaaS dependencies: self-contained PostgreSQL, MinIO, NestJS, and Next.js.
- Strong network isolation keeping database and storage containers off public interfaces.

### Negative / trade-offs

- Scaling across multiple physical host servers requires upgrading to clustering tools in the future if high traffic demands it.

## Constraints

- PostgreSQL and MinIO ports must not be bound to public host network interfaces.
- Secrets and environment variables must be loaded via `.env` files and never committed to Git.

## Related requirements / documents

- [docs/foundation/SYSTEM-CONTEXT.md](../../foundation/SYSTEM-CONTEXT.md)
- [docs/foundation/QUALITY-ATTRIBUTES.md](../../foundation/QUALITY-ATTRIBUTES.md) (`NFR-SEC-001`, `NFR-MNT-003`)
- [ADR-003](ADR-003-backend-platform.md) — Backend Architecture & Modular Monolith
- [ADR-007](ADR-007-postgresql-database.md) — Relational Database Platform
- [ADR-010](ADR-010-attachment-storage.md) — Attachment & Media Storage Architecture

## Supersedes / Superseded by

None.
