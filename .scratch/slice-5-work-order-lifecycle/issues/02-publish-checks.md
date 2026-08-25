# 02 — [JOB-SRS-002] Kiểm tra điều kiện công bố

**What to build:** Trước khi phân công hoặc mở Job Board, hệ thống kiểm tra dự án còn hoạt động, loại công việc hợp lệ, lịch và dữ liệu bắt buộc. Mọi điều kiện chưa đạt được liệt kê cụ thể; không tạo assignment một phần khi kiểm tra thất bại.

**Blocked by:** slice-5/01, slice-4/02 (trạng thái dự án).

**Status:** ready-for-agent

- [ ] Kiểm tra đủ: dự án hoạt động, loại công việc hợp lệ, lịch, dữ liệu bắt buộc.
- [ ] Mọi điều kiện chưa đạt liệt kê cụ thể (không chỉ lỗi chung).
- [ ] Không có assignment một phần khi fail — kiểm tra trước khi mutate.
- [ ] E2e + unit (Seam B).

## Truy vết

SRS JOB-SRS-002 (§7.4, Must); BR-07.
