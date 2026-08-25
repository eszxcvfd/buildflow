# 05 — [SCH-SRS-001] Lập và cập nhật lịch công việc

**What to build:** Điều phối viên thiết lập ngày/giờ bắt đầu, thời lượng dự kiến và hạn hoàn thành cho Work Order. Thời gian bắt đầu trước thời gian kết thúc; thay đổi sau phân công lưu lịch cũ và gửi thông báo cho người liên quan.

**Blocked by:** slice-5/01; dùng bộ so khớp lịch slice-1/09.

**Status:** ready-for-agent

- [ ] Đặt/sửa lịch WO: bắt đầu + thời lượng + hạn hoàn thành.
- [ ] Validate bắt đầu < kết thúc.
- [ ] Đổi lịch sau phân công: lưu giá trị cũ (BR-10) + sự kiện thông báo (placeholder chờ RPT-001).
- [ ] E2e + contract cập nhật.

## Truy vết

SRS SCH-SRS-001 (§7.5, Must); BR-15 (thời gian nhất quán, ISO 8601 UTC theo NETCODE).
