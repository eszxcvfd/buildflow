# Slice 1 — Worker tự nhận Work Order: login, Job Board, self-claim, My Jobs

## Problem Statement

Worker hiện không có cách nào tự tìm và nhận công việc: toàn bộ điều phối phải đi qua điều phối viên, dữ liệu phân tán, thời gian lấp đầy công việc dài, và không có bằng chứng truy vết được. Hệ thống chưa có endpoint nghiệp vụ nào — chỉ có scaffold health/status. Người worker không thể đăng nhập, không thấy việc còn trống, không tự nhận việc, và không thấy việc mình đang giữ.

## Solution

Vertical slice đầu tiên của luồng điều phối kết hợp: worker đăng nhập trên web bằng email/mật khẩu, xem Job Board liệt kê các Work Order đang Mở/Khả dụng, tự nhận việc với một thao tác (self-claim) được xác nhận ngay khi đủ điều kiện, và theo dõi My Jobs (chỉ đọc). Nhiều worker nhận cùng một Work Order thì đúng một người thắng (single-winner), người thua nhận lỗi nghiệp vụ rõ ràng. API là NestJS modular monolith với Prisma trên PostgreSQL; web là Next.js App Router tiêu thụ contract OpenAPI đã sinh typed client.

## User Stories

1. As a worker, I want to log in with my email and password, so that the system knows which Worker I am when I browse and claim work.
2. As a worker, I want a generic error when my credentials are wrong (without revealing whether the account exists), so that I can correct my input without leaking account information.
3. As a worker, I want a locked or deactivated account to be rejected at login, so that inactive staff cannot access the system.
4. As a worker, I want to log out, so that I can end my session on a shared device.
5. As a worker, I want a request with an expired or revoked session token to be rejected, so that my account cannot be used after logout.
6. As a worker, I want to see the Job Board listing Work Orders in Open/Available status, so that I can find available work without waiting for direct assignment.
7. As a worker, I want each Job Board entry to show title, project, required trade/skill and scheduled window, so that I can judge fit before opening details.
8. As a worker, I want to open a Work Order's detail from the Job Board, so that I can review requirements before claiming.
9. As a worker, I want to claim an open Work Order with one action, so that I take responsibility immediately without a second approval round (BR-02).
10. As a worker, I want an immediate confirmation (assignment + updated status) when my self-claim succeeds, so that I know the work is mine.
11. As a worker, I want a clear business error when the Work Order was just claimed by someone else, so that I understand the outcome and can look for other work (BR-05).
12. As a worker, I want to be blocked from claiming when I already hold the Concurrent limit of active Work Orders, so that I am not overloaded.
13. As a worker, I want to be blocked from claiming work that overlaps my existing schedule (Schedule conflict), so that I cannot double-book myself.
14. As a worker, I want to be blocked from claiming work requiring trades/skills I do not have, so that assignments match capability.
15. As a worker, I want to be blocked if my worker profile is not active, so that only operational resources can take work.
16. As a worker, I want to see My Jobs listing Work Orders I hold via Assignment, so that I can track my commitments.
17. As a worker, I want My Jobs to show the current status of each Work Order, so that I know what happens next (read-only in this slice).
18. As a coordinator (via seed data in this slice), I want only Open/Available Work Orders to appear on the Job Board, so that workers never see unavailable work.
19. As a system, I must let exactly one self-claim succeed when multiple workers claim the same Work Order concurrently, so that there is exactly one primary Assignment (BR-03, BR-05).
20. As a system, I must record who claimed, when, and the assignment source (self-claim), so that assignment history is traceable (BR-10).
21. As a developer, I want a seed script that creates demo worker accounts and open Work Orders, so that the slice is demoable and testable end to end.
22. As a developer, I want the API to publish an OpenAPI document covering every endpoint in this slice, so that consumers stay synchronized with the contract.
23. As a web developer, I want TypeScript types generated from the OpenAPI contract, so that the web client cannot drift from the API.
24. As a developer, I want validation and business errors returned in the standard problem-details shape, so that clients can map errors consistently.

## Implementation Decisions

- Scope maps to SRS: subset of IAM (login/logout — IAM-SRS-001/002) and subset of JOB (Job Board, self-claim, My Jobs read-only — per UC-04), plus seed data. Traceability: BR-01..BR-05, BR-10, BR-13.
- Auth: opaque bearer session token, stored hashed in a PostgreSQL sessions table; logout/revocation deletes the row; passwords hashed with bcrypt cost 12 (ADR-0005). No JWT, no Redis in the auth path.
- Persistence: Prisma with pinned version as ORM and migration runner (ADR-0003); the API owns schema and migrations; domain code does not import Prisma types — mappers are the seam.
- Single-winner enforcement: conditional UPDATE (compare-and-set from Open/Available to Assigned) inside one PostgreSQL transaction; rowcount 1 = winner, loser receives a distinct business error (ADR-0004).
- Assignment is effective immediately with no confirmation step, and records its source (self-claim | direct) (SRS Q-02).
- Eligibility for self-claim (BR-04): active worker profile, matching trade/skill, no Schedule conflict (hard block for self-claim per SRS Q-05), under Concurrent limit.
- Concurrent limit (SRS Q-03): count of Work Orders in Assigned + In-progress status held by the worker; default 3, configurable.
- Roles: Project Manager and Coordinator stay separate roles (SRS Q-01); only the Worker role is needed in this slice. Accounts/work orders come from seed data — no admin UI.
- HTTP contract: REST/JSON under /api/v1, problem-details error shape, ISO 8601 UTC timestamps, stable ID format validated at the boundary, per NETCODE.md.
- OpenAPI generated in the API workspace with @nestjs/swagger; web consumes types generated by openapi-typescript; generated files are never hand-edited.
- Module structure follows the API owner doc: bounded contexts as Nest modules with domain/application/api/infrastructure layers; health/status remain platform modules.
- Web surface: Next.js App Router pages for login, Job Board, Work Order detail, My Jobs; Server Components fetch via the API client; worker demo runs on web even though the SRS maps Worker to mobile — mobile is a later slice once the contract stabilizes.
- The first business migration creates users/workers/sessions, work orders, assignments and skill/trade reference data sufficient for the slice.

## Testing Decisions

- A good test asserts observable outcomes at public interfaces (HTTP contract, use-case interface) — never private implementation details or call order.
- Two seams, both aligned with the API owner doc's test table:
  - Seam A (primary, e2e): boot the Nest application with a real PostgreSQL (from the docker compose data services) and drive it over HTTP. Covers login/session rejection, Job Board listing, claim success and each eligibility failure, My Jobs, error contract shape. The single-winner proof lives here: two concurrent claim requests against the same Work Order — exactly one succeeds, the other receives the business "already claimed" error.
  - Seam B (unit): the ClaimWorkOrder use case and eligibility policy tested with in-memory repository fakes — concurrent limit, schedule conflict, skill mismatch, inactive worker — fast feedback without a database.
- The Prisma adapter is exercised through Seam A (integration with real PostgreSQL); no separate ORM-layer test surface.
- Web: typecheck/lint/build plus a route smoke test (pages render, claim calls the real API locally). No new web test infrastructure in this slice.
- Prior art: existing controller specs (health, status) already boot modules with @nestjs/testing — extend that pattern.

## Out of Scope

- Direct assignment by coordinator (including schedule-conflict override with reason)
- Work Order creation/editing UI; scheduling/calendar UI
- Checklists, Quality Inspection, rework, material requests, notifications, dashboards, audit browsing UI
- Mobile app
- User/role administration UI (accounts come from seed)
- Password change/reset (IAM-SRS-007); refresh tokens; external auth providers
- Cooldown after worker cancellation (none in v1 per SRS Q-04)
- Redis beyond the existing compose healthcheck (no cache/rate-limit usage)
- Pagination/sorting/filtering on Job Board beyond a simple list

## Further Notes

- Requirements source: SRS-CWM-QC-001 (SRS.md) §3.3, §5.1, §7.1, §7.4, UC-04; decisions Q-01..Q-05 resolved in SRS §14.1.1.
- Domain vocabulary: CONTEXT.md (Work Order, Job Board, Assignment, Self-claim, Eligibility, Concurrent limit, Schedule conflict, My Jobs).
- Architecture decisions: ADR-0003 (Prisma), ADR-0004 (single-winner via PostgreSQL), ADR-0005 (opaque session tokens).
- Open questions deferred to later slices: Q-06..Q-12 of the SRS remain open and are not needed for this slice.
