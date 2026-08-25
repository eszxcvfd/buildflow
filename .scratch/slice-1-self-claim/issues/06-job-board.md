# 06 — [JOB-SRS-005] Xem Job Board

**What to build:** Worker đã đăng nhập xem Job Board: danh sách Work Order còn trống (Mở/Khả dụng) trong phạm vi được phép, kèm tên việc, dự án, kỹ năng yêu cầu và khung thời gian. Schema Prisma cho Project/Skill/WorkOrder cùng seed dữ liệu demo.

**Blocked by:** 04 (IAM-SRS-002).

**Status:** ready-for-agent

- [ ] Danh sách loại trừ việc đã có người nhận, hết cửa sổ nhận, sai trạng thái, ngoài phạm vi dự án được phép.
- [ ] Request không xác thực bị từ chối.
- [ ] Seed tạo dự án/kỹ năng/Work Order demo, bao gồm cả WO không mở để chứng minh việc lọc.
- [ ] Trang Job Board web; OpenAPI + typed client cập nhật; e2e chứng minh lọc trạng thái và guard.

## Truy vết

SRS JOB-SRS-005 (§7.4, Must); UC-04 bước 2; CONTEXT.md (Job Board, Work Order).
