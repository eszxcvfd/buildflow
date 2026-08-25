# Slice 1 — Worker tự nhận Work Order

- **FR:** IAM-SRS-001, 002, 008; JOB-SRS-005, 006, 007, 008, 009, 010, 011, 016; SCH-SRS-004 (12 Must).
- **SRS:** §7.1, §7.4, §7.5; use case UC-04 (luồng chính), UC-01 (phần login).
- **Spec:** [`spec.md`](spec.md).
- **Điều kiện vào:** không — đây là slice đầu tiên của hệ thống.
- **Song song:** sau ticket 01–02, ticket 05/06/07/08 có thể phân cho người khác; slice 2 và 3 vào sau khi auth (03, 04) xong.
- **Quyết định nền:** ADR-0003 (Prisma), ADR-0004 (single-winner bằng conditional UPDATE), ADR-0005 (opaque session token); Q-01..Q-05 đã chốt (SRS §14.1.1); vocabulary tại [`CONTEXT.md`](../../CONTEXT.md).
- **Lanes + proof** theo [`PLANS.md`](../../PLANS.md) và `docs/process/DEVELOPMENT.md`: e2e qua HTTP với PostgreSQL thật (chứa single-winner proof), unit eligibility với fake, web typecheck/lint/build + route smoke.

## Tickets

- `issues/01-data-test-infra.md` — enabling: Prisma bootstrap + e2e với PostgreSQL thật
- `issues/02-contract-pipeline.md` — enabling: OpenAPI + typed client
- `issues/03-login.md` — IAM-SRS-001
- `issues/04-logout-session.md` — IAM-SRS-002
- `issues/05-auth-audit-log.md` — IAM-SRS-008
- `issues/06-job-board.md` — JOB-SRS-005
- `issues/07-work-order-detail.md` — JOB-SRS-007
- `issues/08-job-board-filters.md` — JOB-SRS-006
- `issues/09-schedule-overlap.md` — SCH-SRS-004
- `issues/10-eligibility.md` — JOB-SRS-009
- `issues/11-self-claim.md` — JOB-SRS-008
- `issues/12-single-winner.md` — JOB-SRS-010
- `issues/13-post-claim-sync.md` — JOB-SRS-011
- `issues/14-my-jobs.md` — JOB-SRS-016

## Ngoại lệ phạm vi

Direct assignment, UI tạo Work Order, lịch (UI), checklist, QC, vật tư, thông báo, mobile app, admin UI — thuộc slice 5+. Nguồn sự thật phạm vi: [`spec.md`](spec.md) mục Out of Scope.
