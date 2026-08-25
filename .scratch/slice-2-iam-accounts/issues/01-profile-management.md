# 01 — [IAM-SRS-003] Quản lý hồ sơ cá nhân

**What to build:** Người dùng xem và cập nhật các trường hồ sơ được phép: họ tên, số điện thoại, ảnh đại diện và thông tin liên hệ. Dữ liệu hợp lệ hiển thị nhất quán trên web và mobile (mobile chưa có — đồng nhất ở mức API contract).

**Blocked by:** slice-1/03, slice-1/04 (auth + guard).

**Status:** ready-for-agent

- [ ] Người dùng xem được hồ sơ của mình và cập nhật các trường được phép.
- [ ] Trường ảnh hưởng định danh (email) hoặc quyền (role) không được tự thay đổi từ endpoint này.
- [ ] Thay đổi hợp lệ hiển thị nhất quán ở các lần truy cập sau.
- [ ] Validation trả lỗi theo field; e2e + OpenAPI/typed client cập nhật.

## Truy vết

SRS IAM-SRS-003 (§7.1, Must); BR-10 (bằng chứng gắn actor/thời điểm).
