---
status: accepted
---

# Dữ liệu E2E phải giống thật nhất có thể

Mọi dữ liệu E2E — gồm bản ghi tạo lúc chạy (runtime-created), seed và demo data trong DB — phải mô phỏng dữ liệu thật nhất có thể: định danh người, dự án, khu vực, đội, ngành nghề và nhà thầu theo dữ kiện kinh doanh thật (tên người Việt, mã kiểu doanh nghiệp, lý do nghiệp vụ tiếng Việt), không dùng placeholder kiểu `E2E%`/`test%`/`probe%` trong dữ liệu hiển thị; uniqueness và phạm vi của test đạt bằng hậu tố tự nhiên (mã có suffix, email corporate đánh số) chứ không bằng chuỗi `E2E`; cleanup phải theo id (dựa trên `e2e-vars`) kèm fallback `created_at` để không để lại rác; `audit_logs` là append-only nên bản ghi lịch sử giữ định danh cũ là có chủ ý; tài liệu quy ước là [`demo-data.md`](../demo-data.md), SQL tái lập là [`rename-realistic.sql`](../evidence/demo-data/rename-realistic.sql), với bằng chứng mẫu tại [`prj-srs-003`](../evidence/prj-srs-003) và [`org-srs-006`](../evidence/org-srs-006).

## Amendment 2026-09-09 — cleanup/seed tĩnh dùng UUID chính xác

Cleanup và seed demo data chuyển sang 2 script tĩnh
([`cleanup-e2e-leftovers.sql`](../evidence/demo-data/cleanup-e2e-leftovers.sql),
[`seed-realistic-operations.sql`](../evidence/demo-data/seed-realistic-operations.sql),
quy ước tại [`demo-data.md`](../demo-data.md) §8): cleanup key **theo UUID
chính xác, không LIKE title và không fallback `created_at`**.
Lý do: rác E2E đợt này đã được re-verify live từng UUID + sweep 0 tham chiếu FK
trước khi chạy, nên key chính xác an toàn hơn fallback `created_at` (tránh xóa
nhầm bản ghi thật trùng cửa sổ thời gian); tính idempotent giữ nguyên
(re-run = no-op). Quy tắc cleanup-theo-id-cho-driver-runtime (`e2e-vars` +
fallback `created_at`) vẫn giữ cho các driver E2E tạo rác lúc chạy.
