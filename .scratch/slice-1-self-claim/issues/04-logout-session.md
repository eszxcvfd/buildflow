# 04 — [IAM-SRS-002] Đăng xuất và hết phiên

**What to build:** Đăng xuất kết thúc phiên (xóa dòng session); request tiếp theo bằng token đã thu hồi hoặc hết hạn bị từ chối. Session guard áp dụng cho route bảo vệ, sẵn sàng cho các endpoint Job Board sau này.

**Blocked by:** 03 (IAM-SRS-001).

**Status:** ready-for-agent

- [ ] Logout làm mất hiệu lực phiên hiện tại; dữ liệu hợp lệ đã lưu không bị mất.
- [ ] Request bằng token đã logout hoặc đã hết hạn bị từ chối 401.
- [ ] Session guard bảo vệ route được chọn; route công khai (health) không bị chặn.
- [ ] Nút logout trên web; OpenAPI + typed client cập nhật; e2e cho cả ba kịch bản.

## Truy vết

SRS IAM-SRS-002 (§7.1, Must); ADR-0005.
