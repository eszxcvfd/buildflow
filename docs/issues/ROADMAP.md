# Roadmap

> Work Routing seed: this is the target repository's canonical owner for the
> current work queue; keep queue entries verified.

## Current work queue

This document is the canonical current work queue. Keep active work, ordering,
dependencies, and explicit blockers here or in the issue tracker named by the
repository's setup configuration. Do not infer priority from an unrelated
document.

1. **Slice 1 — Worker tự nhận Work Order (đang mở)** (spec: [`.scratch/slice-1-self-claim/spec.md`](../../.scratch/slice-1-self-claim/spec.md), tickets: [`.scratch/slice-1-self-claim/issues/`](../../.scratch/slice-1-self-claim/issues/)) — login, Job Board, self-claim với single-winner, My Jobs. Plan conditions tại [`PLANS.md`](../../PLANS.md). Trạng thái: spec + 14 ticket (2 enabling + 12 FR) đã publish, chưa ticket nào được claim.
2. **Slice 2 — Tài khoản và phân quyền hoàn thiện** — IAM-SRS-003, 004, 005, 006. Sau slice 1.
3. **Slice 3 — Tổ chức và nguồn lực** — ORG-SRS-001→005, 008. Sau slice 2.
4. **Slice 4 — Dự án và dữ liệu nền** — PRJ-SRS-001→007. Sau slice 3.
5. **Slice 5 — Tạo, cập nhật, công bố Work Order** — JOB-SRS-001→004, SCH-SRS-001. Sau slice 4.
6. **Slice 6 — Phân công trực tiếp, tái phân công, timeline** — JOB-SRS-012, 013, 022. Sau slice 5.
7. **Slice 7 — Thực hiện và gửi hoàn thành** — JOB-SRS-017, 019, 020; SCH-SRS-002, 003; QUA-SRS-002, 003. Sau slice 6.
8. **Slice 8 — Kiểm soát chất lượng** — QUA-SRS-001, 004→012; JOB-SRS-021. Sau slice 7.
9. **Slice 9 — Vật tư** — MAT-SRS-001→005. Sau slice 7.
10. **Slice 10 — Thông báo, báo cáo, truy vết** — RPT các FR Must. Sau slice 8, 9.

## Routing

Bản đồ 10 slice phủ đủ 67 Must FR (kiểm: 12+4+6+7+5+3+7+11+5+7 = 67); 15 Should FR bắt đầu sau khi workflow Must ổn định theo SRS §6. Mỗi slice đến lượt mới chạy grilling → to-spec → to-tickets; ticket chỉ bẻ cho slice đang làm để không stale.

Use [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md) for lane selection
and proof. Use [`../../PLANS.md`](../../PLANS.md) when work needs a non-trivial
plan or durable coordination. If a queue rule is missing, record the bounded
inference or update this canonical owner before relying on it.
