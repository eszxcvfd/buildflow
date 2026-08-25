# 13 — [JOB-SRS-011] Đồng bộ sau khi tự nhận

**What to build:** Đồng bộ sau khi tự nhận thành công: Work Order rời Job Board (khi làm mới), chuyển trạng thái Đã phân công, xuất hiện trong danh sách việc của worker; các kênh hiển thị cùng assignee và trạng thái; lỗi cập nhật phụ không tạo assignment thứ hai khi thử lại.

**Blocked by:** 11 (JOB-SRS-008).

**Status:** ready-for-agent

- [ ] Sau claim, Job Board (refresh) không còn Work Order đó; trạng thái là Đã phân công; Work Order xuất hiện trong danh sách của worker.
- [ ] Retry sau lỗi tạm thời không tạo assignment thứ hai.
- [ ] E2E chứng minh đồng bộ; OpenAPI + typed client cập nhật nếu shape đổi.

## Truy vết

SRS JOB-SRS-011 (§7.4, Must).
