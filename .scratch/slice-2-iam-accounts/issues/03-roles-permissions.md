# 03 — [IAM-SRS-005] Gán vai trò và quyền

**What to build:** Quản trị viên gán một hoặc nhiều vai trò đã phê duyệt cho tài khoản; hệ thống kiểm soát quyền xem và quyền thao tác ở phía hệ thống (không chỉ ẩn nút UI). Vai trò: Quản trị viên, Quản lý dự án, Điều phối viên, Worker, QC (giữ riêng theo Q-01).

**Blocked by:** slice-2/02 (quản lý tài khoản).

**Status:** ready-for-agent

- [ ] Gán/nhiều vai trò cho tài khoản; chỉ quản trị viên được thao tác.
- [ ] Kiểm tra quyền thực hiện phía hệ thống — ẩn nút UI không thay thế.
- [ ] Thay đổi quyền có hiệu lực với lần truy cập tiếp theo theo chính sách phiên.
- [ ] E2e: user không đủ vai trò gọi endpoint bị chặn 403.

## Truy vết

SRS IAM-SRS-005 (§7.1, Must); ma trận quyền §2.4; BR-13; Q-01 đã chốt.
