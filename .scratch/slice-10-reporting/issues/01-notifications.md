# 01 — [RPT-SRS-001] Tạo thông báo nghiệp vụ

**What to build:** Hệ thống tạo thông báo trong ứng dụng khi: được giao việc, tự nhận thành công, lịch thay đổi, bị thu hồi, cần làm lại hoặc có quyết định vật tư. Thông báo nhắm đúng người, không tạo trùng khi tác vụ được thử lại, chứa đối tượng nguồn.

**Blocked by:** slice-8 (events QC), slice-9 (events vật tư); cắm placeholder events từ slice 5–9.

**Status:** ready-for-agent

- [ ] Đủ loại sự kiện: giao việc, tự nhận, đổi lịch, thu hồi, cần làm lại, quyết định vật tư.
- [ ] Thông báo nhắm đúng người; chứa tham chiếu đối tượng nguồn.
- [ ] Idempotent: retry tác vụ nguồn không tạo thông báo trùng.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS RPT-SRS-001 (§7.8, Must); BR-14.
