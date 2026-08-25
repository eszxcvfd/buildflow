# Roadmap

> Work Routing seed: this is the target repository's canonical owner for the
> current work queue; keep queue entries verified.

## Current work queue

This document is the canonical current work queue. Keep active work, ordering,
dependencies, and explicit blockers here or in the issue tracker named by the
repository's setup configuration. Do not infer priority from an unrelated
document.

1. **Slice 1 — Worker tự nhận Work Order (đang mở)** (14 ticket: 2 enabling + 12 FR) — [spec](../../.scratch/slice-1-self-claim/spec.md) · [tickets](../../.scratch/slice-1-self-claim/issues/). IAM-001/002/008, JOB-005→011/016, SCH-004.
2. **Slice 2 — Tài khoản và phân quyền hoàn thiện** (4 ticket) — [tickets](../../.scratch/slice-2-iam-accounts/issues/). IAM-003/004/005/006. Vào sau slice-1 auth; song song slice 3.
3. **Slice 3 — Tổ chức và nguồn lực** (6 ticket) — [tickets](../../.scratch/slice-3-org-resources/issues/). ORG-001→005, 008. Song song slice 2.
4. **Slice 4 — Dự án và dữ liệu nền** (7 ticket) — [tickets](../../.scratch/slice-4-projects/issues/). PRJ-001→007. Sau slice 2 (roles) + slice 3/03 (kỹ năng).
5. **Slice 5 — Tạo, cập nhật, công bố Work Order** (5 ticket) — [tickets](../../.scratch/slice-5-work-order-lifecycle/issues/). JOB-001→004, SCH-001. Sau slice 4.
6. **Slice 6 — Phân công trực tiếp, tái phân công, timeline** (3 ticket) — [tickets](../../.scratch/slice-6-direct-assignment/issues/). JOB-012/013/022. Sau slice 5.
7. **Slice 7 — Thực hiện và gửi hoàn thành** (7 ticket) — [tickets](../../.scratch/slice-7-execution/issues/). JOB-017/019/020, SCH-002/003, QUA-002/003. Sau slice 6. **Q-07 chốt trước ticket 06.**
8. **Slice 8 — Kiểm soát chất lượng** (11 ticket) — [tickets](../../.scratch/slice-8-quality/issues/). QUA-001/004→012, JOB-021. Sau slice 7. **Q-08 chốt trước ticket 06.**
9. **Slice 9 — Vật tư** (5 ticket) — [tickets](../../.scratch/slice-9-materials/issues/). MAT-001→005. Sau slice 7; song song slice 8.
10. **Slice 10 — Thông báo, báo cáo, truy vết** (7 ticket) — [tickets](../../.scratch/slice-10-reporting/issues/). RPT Must. Sau slice 8, 9. **Q-06 chốt trước ticket 04; Q-12 ảnh hưởng 06/07.**

## Routing

Bản đồ 10 slice phủ đủ 67 Must FR (kiểm: 12+4+6+7+5+3+7+11+5+7 = 67), mỗi FR một ticket (67 FR ticket + 2 enabling = 69 file). 15 Should FR thuộc backlog, bắt đầu sau khi workflow Must ổn định theo SRS §6.

## Chia việc team 5 người

- **Giai đoạn đầu (slice 1):** 1 người làm enabling 01→02 rồi auth 03→04; những người còn lại review/đồng bộ hoặc hỗ trợ ticket không phụ thuộc (06 Job Board sau khi 04 xong).
- **Song song:** slice 2 (IAM) ∥ slice 3 (ORG) sau khi auth xong — 2 người; slice 4 cần 2 mảnh trước đó; slice 8 ∥ slice 9 về sau.
- **Quy ước 1 writer/1 scope:** mỗi ticket chỉ 1 người claim (đặt `Status: claimed` trong file); cross-slice coordination theo WORK-ROUTING.md §5.
- **Q-item phải chốt trước ticket tương ứng:** Q-07 (slice 7/06), Q-08 (slice 8/06), Q-06 (slice 10/04), Q-11/Q-12 khi đến nghiệm thu mobile/retention. Chốt bằng phiên grilling ngắn rồi ghi SRS §14.1.1.

Use [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md) for lane selection
and proof. Use [`../../PLANS.md`](../../PLANS.md) when work needs a non-trivial
plan or durable coordination. If a queue rule is missing, record the bounded
inference or update this canonical owner before relying on it.
