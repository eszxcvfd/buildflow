# 01 — [JOB-SRS-001] Tạo Work Order nháp

**What to build:** Điều phối viên tạo Work Order gắn với dự án, khu vực/hạng mục, loại công việc, mô tả, ưu tiên, thời hạn và yêu cầu kỹ năng. Thiếu dữ liệu bắt buộc chỉ cho lưu Nháp; WO nháp chưa được phân công hoặc hiển thị trên Job Board.

**Blocked by:** slice-4/01, slice-4/03, slice-4/04, slice-3/03.

**Status:** ready-for-agent

- [ ] Tạo WO nháp với đủ liên kết (dự án/khu vực/loại/kỹ năng).
- [ ] Thiếu dữ liệu bắt buộc → chỉ lưu Nháp được, không mở/không assign.
- [ ] WO nháp không xuất hiện trên Job Board (đối chiếu slice-1/06).
- [ ] E2e + contract cập nhật.

## Truy vết

SRS JOB-SRS-001 (§7.4, Must); UC-03.
