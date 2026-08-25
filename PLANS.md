# Plans

> Work Routing seed: this is the target repository's canonical owner for plan
> conditions and contents; keep project facts and decisions verified.

## Ownership

This document owns the conditions and contents for design notes, non-trivial
plans, and durable coordination in this repository.

## When a plan is required

Create or update a checked-in plan when the work is non-trivial, crosses
ownership boundaries, changes a runtime or protocol contract, changes server
resource or cook/package boundaries, or needs durable coordination. For
doc-only edits, small owner-neutral fixes, and partial progress, do not create
or trigger plan closeout unless an existing governing plan requires it.

If the repository's governing documents are silent or stale, record the bounded
inference or update the canonical owner before relying on a new plan rule.

## Required contents

A checked-in plan should state, as applicable:

- the objective, scope, and non-goals;
- the current contract and canonical owner for each affected boundary;
- the selected lane and proof required by
  [`docs/process/DEVELOPMENT.md`](docs/process/DEVELOPMENT.md);
- dependencies, risks, decisions, and bounded inferences;
- the files, producers, consumers, generated artifacts, tests, fixtures, and
  validators that must stay synchronized;
- completion evidence and any remaining follow-up.

## Current plans

### Slice 1 — Worker tự nhận Work Order (spec: #1)

- **Objective:** vertical slice đầu tiên của luồng điều phối kết hợp — worker login, xem Job Board, self-claim Work Order còn trống (đúng 1 winner khi cạnh tranh), My Jobs chỉ đọc. Spec đầy đủ: [issue #1](https://github.com/eszxcvfd/buildflow/issues/1).
- **Non-goals:** direct assignment, UI tạo Work Order, lịch, checklist, QC, vật tư, thông báo, mobile, admin UI.
- **Lanes:** `api` (domain/application/controller + Prisma adapter), `contract` (endpoint đầu tiên + OpenAPI + web typed client — coordinating), `web` (login/Job Board/My Jobs), `data` (migration đầu tiên qua Prisma). Proof theo `docs/process/DEVELOPMENT.md`: e2e qua HTTP với PostgreSQL thật (chứa single-winner proof), unit eligibility với fake, web typecheck/lint/build + route smoke.
- **Quyết định nền:** ADR-0003 (Prisma), ADR-0004 (single-winner bằng conditional UPDATE), ADR-0005 (opaque session token); SRS Q-01..Q-05 đã chốt tại SRS §14.1.1; vocabulary tại `CONTEXT.md`.
- **Phải đồng bộ trong cùng change:** API producer, OpenAPI document, web typed client (generated), migration, seed script, test e2e/unit.
- **Completion evidence (chưa có — cập nhật khi closeout):** kết quả test/typecheck/build của từng lane, bằng chứng single-winner, demo route smoke.
