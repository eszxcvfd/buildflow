# 03 — [IAM-SRS-001] Đăng nhập

**What to build:** Worker đăng nhập bằng email + mật khẩu trên web và được cấp phiên theo vai trò. Session là opaque bearer token (random 256-bit, lưu dạng hash trong bảng sessions của PostgreSQL — ADR-0005); mật khẩu hash bcrypt cost 12. Sai thông tin trả lỗi chung, không tiết lộ tài khoản có tồn tại; tài khoản khóa/ngừng hoạt động bị từ chối.

**Blocked by:** 01, 02.

**Status:** ready-for-agent

- [ ] Đăng nhập đúng cấp token; request mang token được chấp nhận.
- [ ] Sai mật khẩu và tài khoản không tồn tại trả cùng một thông báo lỗi chung.
- [ ] Tài khoản bị khóa hoặc ngừng hoạt động bị từ chối.
- [ ] Token lưu dạng hash trong PostgreSQL; không lưu plaintext bí mật nào.
- [ ] Trang login web chạy được với tài khoản seed; OpenAPI + typed client cập nhật.
- [ ] E2E (Seam A, PostgreSQL thật) phủ các kịch bản trên.

## Truy vết

SRS IAM-SRS-001 (§7.1, Must); ADR-0005; CONTEXT.md (Worker).
