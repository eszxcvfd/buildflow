# 07 — [RPT-SRS-008] Tra cứu lịch sử thao tác

**What to build:** Người có quyền lọc lịch sử theo thời gian, người thao tác, loại đối tượng và hành động. Dữ liệu lịch sử chỉ đọc; kết quả tôn trọng quyền; có thể mở đối tượng nguồn khi còn tồn tại và được phép.

**Blocked by:** slice-10/06.

**Status:** ready-for-agent

- [ ] Lọc theo thời gian, người thao tác, loại đối tượng, hành động.
- [ ] Read-only; tôn trọng quyền (BR-13).
- [ ] Mở đối tượng nguồn khi còn tồn tại + được phép; hết/quyền mất → thông báo phù hợp.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS RPT-SRS-008 (§7.8, Must); BR-11.
