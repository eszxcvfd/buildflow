# Workspace Protocol — BuildFlow

<!-- PASEO_WORKSPACE_PROTOCOL_VERSION: 2 -->

- identity: `owner=Human; version=1; last_reviewed=2026-08-21; applies_to=/home/trung/Documents/2026/project/buildflow`
- project risk/protected areas: `pre-publication scaffold; risk class=unclassified; protect src/api domain and HTTP/OpenAPI contract, src/web and src/mobile boundaries, runtime/environment credentials, and generated artifacts; target-design documents are not runtime evidence`
- default topology: `Lead-direct for exact tiny coordination or documentation edits; use one bounded Engineer Peer for product implementation; use an independent Reviewer in a fresh worktree for material candidate review; add Supervisor observation only when it can change a decision or reduce risk`
- ownership/hotspots: `one writer per moving scope; src/api owns domain and API contract, src/web owns web presentation/routes, src/mobile owns the mobile client, and documentation ownership follows docs/README.md and WORK-ROUTING.md; Human owns merge, push, deploy, and irreversible product decisions`
- routing defaults: `route by producer and owner using WORK-ROUTING.md; read ARCHITECTURE.md plus the smallest relevant owner docs; every delegated task states reason, scope, base/candidate SHA where applicable, and expiry; no silent provider/model/host fallback`
- peer model routing: `Peer dùng model đúng theo: /home/trung/.paseo-pi-team`.
- project policy: `no package or runtime version is locked yet; when one is adopted, record its exact package/version, scope, authority, and conflict rule in the owning document or ADR; keep the pre-publication API/protocol as one current v1 contract with no legacy or fallback path`
- review/evidence: `documentation changes require file/link/tree/source consistency only; code changes require the lane proof in docs/process/DEVELOPMENT.md; never claim test, build, lint, or runtime success without command output; Lead owns acceptance and Human owns merge/deploy`
- escalation/Human decisions: `Peers may return REOPEN_REQUEST, DEPENDENCY_REQUEST, or BLOCKED with file/command evidence; unresolved domain, product, security, or irreversible decisions go to Human; durable decisions belong in the relevant owner document, ADR, or PLANS.md`
- repository exceptions/anti-patterns: `no second routing rule, no two writers on one moving scope, no cross-workspace implementation imports, no backend logic duplicated in web BFF routes, no shared DOM/native UI or speculative infrastructure, and no treating scaffold placeholders as verified runtime behavior`

LEAD_WRITE_POLICY: allowed for this coordination artifact only; product implementation remains Engineer Peer-owned.
