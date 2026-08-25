# 04 — [IAM-SRS-006] Giới hạn dữ liệu theo dự án

**What to build:** Hệ thống giới hạn dữ liệu nghiệp vụ theo vai trò và danh sách dự án người dùng tham gia. Thay đổi mã đối tượng hoặc đường dẫn không cho phép truy cập dự án ngoài phạm vi; vai trò quản trị ngoại lệ phải được xác định rõ và audit.

**Blocked by:** slice-2/03 (roles); schema thành viên dự án thuộc slice 4/05 — phối hợp khi slice 4PRJ-005 landing.

**Status:** ready-for-agent

- [ ] Danh sách/chi tiết Work Order, dự án bị giới hạn theo vai trò + dự án tham gia.
- [ ] Đổi ID/đường dẫn không truy cập được dữ liệu ngoài phạm vi (thử direct GET).
- [ ] Quản trị viên ngoại lệ được phép nhưng tạo dòng audit.
- [ ] E2e phủ truy cập chéo dự án bị chặn.

## Truy vết

SRS IAM-SRS-006 (§7.1, Must); BR-13.
