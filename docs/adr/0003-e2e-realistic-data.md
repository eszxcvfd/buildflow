---
status: accepted
---

# Dữ liệu E2E phải giống thật nhất có thể

Mọi dữ liệu E2E — gồm bản ghi tạo lúc chạy (runtime-created), seed và demo data trong DB — phải mô phỏng dữ liệu thật nhất có thể: định danh người, dự án, khu vực, đội, ngành nghề và nhà thầu theo dữ kiện kinh doanh thật (tên người Việt, mã kiểu doanh nghiệp, lý do nghiệp vụ tiếng Việt), không dùng placeholder kiểu `E2E%`/`test%`/`probe%` trong dữ liệu hiển thị; uniqueness và phạm vi của test đạt bằng hậu tố tự nhiên (mã có suffix, email corporate đánh số) chứ không bằng chuỗi `E2E`; cleanup phải theo id (dựa trên `e2e-vars`) kèm fallback `created_at` để không để lại rác; `audit_logs` là append-only nên bản ghi lịch sử giữ định danh cũ là có chủ ý; tài liệu quy ước là [`demo-data.md`](../demo-data.md), SQL tái lập là [`rename-realistic.sql`](../evidence/demo-data/rename-realistic.sql), với bằng chứng mẫu tại [`prj-srs-003`](../evidence/prj-srs-003) và [`org-srs-006`](../evidence/org-srs-006).
