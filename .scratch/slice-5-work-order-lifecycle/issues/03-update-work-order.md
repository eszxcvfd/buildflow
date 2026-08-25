# 03 — [JOB-SRS-003] Cập nhật Work Order

**What to build:** Điều phối viên cập nhật mô tả, ưu tiên, thời hạn, hướng dẫn và dữ liệu được phép khi trạng thái cho phép. Thay đổi lịch, kỹ năng hoặc người thực hiện phải gửi thông báo và lưu giá trị trước/sau; dữ liệu bị khóa sau hoàn tất chỉ sửa qua quy trình ngoại lệ.

**Blocked by:** slice-5/01.

**Status:** ready-for-agent

- [ ] Cập nhật các trường cho phép theo trạng thái (BR-07).
- [ ] Đổi lịch/kỹ năng/người thực hiện: lưu giá trị trước/sau (đối chiếu JOB-022 slice 6).
- [ ] Thông báo: tạm dùng placeholder event nội bộ — RPT-001 (slice 10) hoàn thiện UI.
- [ ] WO hoàn tất bị khóa sửa trừ ngoại lệ có quyền + lý do.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS JOB-SRS-003 (§7.4, Must); BR-06, BR-07, BR-10.
